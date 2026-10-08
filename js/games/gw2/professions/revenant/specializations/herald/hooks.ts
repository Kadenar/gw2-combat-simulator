import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { EffectAudience } from '#gw2/platform/events/events.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip, skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep, removeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { completeRevenantCastTraits } from '#gw2/professions/revenant/core/traits/dispatch.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { revenantFacetParents, revenantUpkeepConsumeId } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { heraldBuffPolicies } from '#gw2/professions/revenant/specializations/herald/effect-state.js';
import {
  FACET_PULSE,
  heraldFacetPassiveActive,
  scheduleFacetPulse
} from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import { HERALD_NATURE_ASSASSIN_PROFILE_ID } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import {
  COMPASSION,
  compassionPulse,
  coreValueExtension,
  ECHO_EXPIRY,
  echoExpiry,
  retainDraconicEcho,
  syncCompassion
} from '#gw2/professions/revenant/specializations/herald/traits/behavior.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';

function facetPulse(runtime: RevenantRuntime, data: unknown): void {
  const { skillId } = data as { skillId: SkillId };
  const state = heraldState.from(runtime);
  if (state.facetPulseReadyAt[skillId] !== runtime.time) return;
  if (!heraldFacetPassiveActive(runtime.profession.core, state, skillId, runtime.time)) return;
  const skill: RevenantSkill | undefined = runtime.helpers.skillsById.get(skillId);
  const pulse = skill?.upkeepPulse;
  if (!skill || !pulse) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: `${skill.name} - ${pulse.kind}`,
      kind: pulse.kind,
      duration: pulse.duration,
      stacks: pulse.stacks,
      audience: { recipients: 'party' }
    }
  });
  const next = canonicalTime(runtime.time + Math.max(EPSILON, skill.pulseInterval ?? 3));
  if (heraldFacetPassiveActive(runtime.profession.core, state, skillId, next))
    scheduleFacetPulse(runtime, skillId, next);
  else state.facetPulseReadyAt[skillId] = next;
}

/** An activated facet arms its consume and starts its own boon cadence at completion. */
function startFacet(runtime: RevenantRuntime, skill: RevenantSkill): void {
  if (!skill.facet || !activeRevenantUpkeep(runtime, skill.id)) return;
  const core = runtime.profession.core;
  const state = heraldState.from(runtime);
  delete state.lingeringFacets[skill.id];
  const consumeId = revenantUpkeepConsumeId(skill, core.activeLegendId);
  if (consumeId != null) armSkillFlip(core.availableFlips, consumeId, runtime.time);
  if (!skill.upkeepPulse) return;
  scheduleFacetPulse(runtime, skill.id, canonicalTime(runtime.time + Math.max(EPSILON, skill.pulseInterval ?? 3)));
}

// A committed consume's facet and prior activity are acceptance facts reused at its completion.
const consumedFacets = new WeakMap<RuntimeCast<RevenantSkill>, { facet: RevenantSkill; wasActive: boolean }>();

function consumedFacet(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): RevenantSkill | undefined {
  return revenantFacetParents(runtime.helpers.skillsById).get(cast.skill.id);
}

/** A committed consume ends the facet's drain and passive immediately; its follow-up is spent. */
function startConsume(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const facet = consumedFacet(runtime, cast);
  const wasActive = Boolean(facet && removeRevenantUpkeep(runtime, facet.id));
  runtime.resourceController.refresh('energy');
  consumeSkillFlip(runtime.profession.core.availableFlips, cast.skill.id);
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
  retainDraconicEcho(runtime, facet, wasActive);
}

/** True Nature (Dragon) extends boons when its authored proc lands; Core Value adds its patched extension. */
function trueNatureDragon(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const proc = cast.skill.effects?.find(
    (effect) =>
      effect.type === 'custom' && (effect.event as { procType?: string } | undefined)?.procType === 'boon-extension'
  );
  const authored =
    proc?.type === 'custom' ? (proc.event as { name?: string; duration?: number; audience?: EffectAudience }) : null;
  if (!authored) return;
  const extension = Math.max(0, authored.duration || 0) + coreValueExtension(runtime);
  if (extension <= 0) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'boon_extension',
      at: runtime.time,
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      procType: 'boon-extension',
      name: authored.name,
      duration: extension,
      ...(authored.audience ? { audience: authored.audience } : {}),
      extensionAudience: 'all'
    }
  });
}

/** Landed player strikes under Assassin Nature (active or retained) siphon once per cooldown; siphons never recurse. */
function natureSiphon(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const core = runtime.profession.core;
  const state = heraldState.from(runtime);
  const active = activeRevenantUpkeep(runtime, ID.FACET_OF_NATURE);
  const legend = active ? core.activeLegendId : state.lingeringFacets[ID.FACET_OF_NATURE]?.legendId;
  if (legend !== LEGEND.ASSASSIN || !heraldFacetPassiveActive(core, state, ID.FACET_OF_NATURE, runtime.time)) return;
  const profile = requireBalanceProfileFromContext(runtime, HERALD_NATURE_ASSASSIN_PROFILE_ID);
  const strike = requireEffect(profile, 'strike', 'Life Siphon');
  // The cooldown gates only the siphon, so a removed strike leaves it ready.
  if (!strike) return;
  if (
    !runtime.procs.claimCooldown(
      'revenant.herald.natureSiphon',
      runtime.time,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverStrike({
      at: runtime.time,
      source: 'revenant',
      sourceId: ID.FACET_OF_NATURE,
      skillId: ID.FACET_OF_NATURE,
      skillName: profile.name,
      name: 'Facet of Nature — Life Siphon',
      actorType: 'effect',
      ownerActorType: 'player',
      coefficient: 0,
      canCrit: false,
      damageKind: 'life-steal',
      flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
      skillWeapon: 'Unequipped',
      triggeredBy: event.skillName
    })
  });
}

/** Herald owns facet availability, lifecycle, passives, and Dragon invocation on the shared live state. */
export const heraldHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  buffPolicies: heraldBuffPolicies,
  initialize(runtime) {
    // Reject invalid selected relationships before any facet can spend Energy or arm a flip.
    revenantFacetParents(runtime.helpers.skillsById);
  },
  // Accepted recipient delivery and self-source exclusion guard the shared profile cooldown.

  availability(runtime, skill) {
    const core = runtime.profession.core;
    if (skill.consume && !skillFlipReady(core.availableFlips[skill.id], runtime.time))
      return denySkillCast(skill, 'revenant.facet-inactive', 'activate the matching facet first.');
    if (skill.facet && activeRevenantUpkeep(runtime, skill.id))
      return denySkillCast(skill, 'revenant.facet-active', 'the facet is already active; consume it instead.');
    return { ready: true };
  },
  // Facet actions finish before the observer evaluates the resulting aggregate upkeep.
  onCastCancel: syncCompassion,
  onCastCommit: syncCompassion,
  sideEffectHandlers: {
    'revenant.start-facet'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCastTraits(runtime, context.cast);
      startFacet(runtime, context.skill);
    },
    'revenant.start-consume'(runtime, context) {
      if (context.kind === 'cast') startConsume(runtime, context.cast);
    },
    'revenant.complete-consume'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCastTraits(runtime, context.cast);
      completeConsume(runtime, context.cast);
    },
    'revenant.true-nature-dragon'(runtime, context) {
      if (context.kind === 'cast') trueNatureDragon(runtime, context.cast);
    }
  },
  reactions: {
    'damage.resolved': natureSiphon
  },
  // Sustained boon pulses are ambient; facet consumption and its damage keep their own queued effects.
  backgroundTasks: [FACET_PULSE],
  tasks: {
    [FACET_PULSE]: facetPulse,
    [ECHO_EXPIRY]: echoExpiry,
    [COMPASSION]: compassionPulse
  }
};
