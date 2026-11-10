/** Own facet activation, consumption, retained passives, and their shared pulse cadence. */
import { ACTOR, BOON_NAMES, RECIPIENT } from '#gw2/platform/constants.js';
import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { completeRevenantCast } from '#gw2/professions/revenant/core/mechanics/completion.js';
import { activeRevenantUpkeep, removeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { revenantFacetParents, revenantUpkeepConsumeId } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { facetConsumed } from '#gw2/professions/revenant/specializations/herald/mechanics/trigger-points.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalInterval, canonicalTime } from '#kernel/core/clock.js';

const FACET_PULSE = 'revenant.herald-facet-pulse';
const RETENTION_EXPIRY = 'revenant.herald-facet-retention-expiry';

/** Each facet pulse is identified by its scheduled instant; reactivation or expiry leaves stale pulses inert. */
function scheduleFacetPulse(runtime: RevenantRuntime, skillId: SkillId, at: number): void {
  heraldState.from(runtime.profession).facetPulseReadyAt[skillId] = at;
  runtime.schedule(FACET_PULSE, at, { skillId });
}

/** Active facets follow the current legend; retained passives keep their captured legend until expiry. */
export function heraldFacetPassive(
  core: Partial<RevenantCoreState>,
  state: Partial<HeraldState>,
  skillId: SkillId,
  at: number
): { readonly legendId: string | undefined } | undefined {
  if (core.activeUpkeeps?.some((upkeep) => upkeep.skillId === skillId && upkeep.startsAt <= at))
    return { legendId: core.activeLegendId };

  const lingering = state.lingeringFacets?.[skillId];
  return lingering && lingering.startsAt <= at && at < lingering.expiresAt
    ? { legendId: lingering.legendId }
    : undefined;
}

/** Retention preserves the existing pulse phase without keeping an Energy-draining upkeep alive. */
export function retainHeraldFacet(runtime: RevenantRuntime, facet: RevenantSkill, duration: number): void {
  const state = heraldState.from(runtime.profession);
  const expiresAt = canonicalTime(runtime.time + duration);
  state.lingeringFacets[facet.id] = {
    startsAt: runtime.time,
    expiresAt,
    legendId: runtime.profession.core.activeLegendId
  };
  const nextAt = state.facetPulseReadyAt[facet.id];

  if (facet.upkeepPulse && nextAt >= runtime.time && nextAt < expiresAt) scheduleFacetPulse(runtime, facet.id, nextAt);

  runtime.schedule(RETENTION_EXPIRY, expiresAt, { skillId: facet.id, expiresAt });
}

/** An old retention expiry cannot clear a replacement window or a reactivated facet. */
function expireRetention(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, expiresAt } = data as { skillId: SkillId; expiresAt: number };
  const state = heraldState.from(runtime.profession);

  if (state.lingeringFacets[skillId]?.expiresAt === expiresAt) delete state.lingeringFacets[skillId];
}

/** Each recurring passive emits its computed boon profile and schedules the next eligible pulse. */
function facetPulse(runtime: RevenantRuntime, data: unknown): void {
  const { skillId } = data as { skillId: SkillId };
  const state = heraldState.from(runtime.profession);

  if (state.facetPulseReadyAt[skillId] !== runtime.time) return;

  if (!heraldFacetPassive(runtime.profession.core, state, skillId, runtime.time)) return;

  const skill: RevenantSkill | undefined = runtime.helpers.skillsById.get(skillId);
  const pulse = skill?.upkeepPulse;

  if (!skill || !pulse) return;

  runtime.effects.emit({
    kind: 'profile',
    profile: skill,
    at: runtime.time,
    attribution: {
      source: 'revenant',
      sourceId: skill.id,
      actorType: ACTOR.PLAYER,
      skillId: skill.id,
      skillName: skill.name
    },
    effects: [
      {
        type: 'boon',
        boon: pulse.kind,
        duration: pulse.duration,
        stacks: pulse.stacks,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ],
    transform: (event) => ({ ...event, name: `${skill.name} - ${BOON_NAMES[pulse.kind]}` })
  });
  const next = canonicalTime(runtime.time + canonicalInterval(skill.pulseInterval ?? 3));

  if (heraldFacetPassive(runtime.profession.core, state, skillId, next)) scheduleFacetPulse(runtime, skillId, next);
  else state.facetPulseReadyAt[skillId] = next;
}

/** An activated facet arms its consume and starts its own boon cadence at completion. */
function startFacet(runtime: RevenantRuntime, skill: RevenantSkill): void {
  if (!skill.facet || !activeRevenantUpkeep(runtime, skill.id)) return;

  const core = runtime.profession.core;
  const state = heraldState.from(runtime.profession);
  delete state.lingeringFacets[skill.id];
  const consumeId = revenantUpkeepConsumeId(skill, core.activeLegendId);

  if (consumeId != null) runtime.armFlip(consumeId);

  if (!skill.upkeepPulse) return;

  scheduleFacetPulse(runtime, skill.id, canonicalTime(runtime.time + canonicalInterval(skill.pulseInterval ?? 3)));
}

// A committed consume's facet and prior activity are acceptance facts reused at its completion.
const consumedFacets = new WeakMap<RuntimeCast<RevenantSkill>, { facet: RevenantSkill; wasActive: boolean }>();

/** Resolve the consume against the selected catalog so patches retain ownership of the parent relationship. */
function consumedFacet(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): RevenantSkill | undefined {
  return revenantFacetParents(runtime.helpers.skillsById).get(cast.skill.id);
}

/** A committed consume ends the facet's drain and passive immediately; its follow-up is spent. */
function startConsume(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const facet = consumedFacet(runtime, cast);
  const wasActive = Boolean(facet && removeRevenantUpkeep(runtime, facet.id));
  runtime.resourceController.refresh('energy');
  runtime.consumeFlip(cast.skill.id);

  if (facet) consumedFacets.set(cast, { facet, wasActive });
}

/** The parent recharge and any Draconic Echo retention begin when the consume completes. */
function completeConsume(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const consumed = consumedFacets.get(cast);
  consumedFacets.delete(cast);

  if (!consumed) return;

  const { facet, wasActive } = consumed;

  // Parent ownership makes Facet of Nature's cooldown shared by every legend-specific True Nature.
  if (cast.rechargeWork > 0) runtime.cooldownController.startRecharge(facet, runtime.time, cast.rechargeWork);

  runtime.fireTrigger(facetConsumed, { facet, wasActive });
}

/** Facet consumes require their armed follow-up, while active facets cannot be activated twice. */
function heraldFacetAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: RevenantSkill
): AvailabilityResult {
  if (skill.consume && !skillFlipReady(runtime.flips[skill.id], runtime.time))
    return denySkillCast(skill, 'revenant.facet-inactive', 'activate the matching facet first.');

  if (skill.facet && activeRevenantUpkeep(runtime, skill.id))
    return denySkillCast(skill, 'revenant.facet-active', 'the facet is already active; consume it instead.');

  return { ready: true };
}

/** Register facet work together so Core rewards precede transitions and retained work uses the same cadence. */
export const heraldFacetLifecycle: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  initialize(runtime) {
    // Validate the selected parent relationships before any facet can spend Energy or arm a flip.
    revenantFacetParents(runtime.helpers.skillsById);
  },
  availability: heraldFacetAvailability,
  sideEffectHandlers: {
    'revenant.start-facet'(runtime, context) {
      if (context.kind !== 'cast') return;

      completeRevenantCast(runtime, context.cast);
      startFacet(runtime, context.skill);
    },
    'revenant.start-consume'(runtime, context) {
      if (context.kind === 'cast') startConsume(runtime, context.cast);
    },
    'revenant.complete-consume'(runtime, context) {
      if (context.kind !== 'cast') return;

      completeRevenantCast(runtime, context.cast);
      completeConsume(runtime, context.cast);
    }
  },
  // Sustained boon pulses are ambient; consumes and their damage keep their own queued effects.
  backgroundTasks: [FACET_PULSE],
  tasks: {
    [FACET_PULSE]: facetPulse,
    [RETENTION_EXPIRY]: expireRetention
  }
};
