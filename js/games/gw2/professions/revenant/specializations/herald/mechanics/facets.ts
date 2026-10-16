import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip, skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { activeRevenantUpkeep, removeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { revenantFacetParents, revenantUpkeepConsumeId } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { facetConsumed } from '#gw2/professions/revenant/specializations/herald/mechanics/trigger-points.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalInterval, canonicalTime } from '#kernel/core/clock.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { HeraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';

export const FACET_PULSE = 'revenant.herald-facet-pulse';

/** Each facet pulse is identified by its scheduled instant; reactivation or expiry leaves stale pulses inert. */
export function scheduleFacetPulse(runtime: RevenantRuntime, skillId: SkillId, at: number): void {
  heraldState.from(runtime).facetPulseReadyAt[skillId] = at;
  runtime.schedule(FACET_PULSE, at, { skillId });
}

/** Active upkeep and retained passives share eligibility, but only upkeep drains Energy. */
export function heraldFacetPassiveActive(
  core: Partial<RevenantCoreState>,
  state: Partial<HeraldState>,
  skillId: SkillId,
  at: number
): boolean {
  const lingering = state.lingeringFacets?.[skillId];
  return Boolean(
    core.activeUpkeeps?.some((upkeep) => upkeep.skillId === skillId && upkeep.startsAt <= at) ||
    (lingering && lingering.startsAt <= at && at < lingering.expiresAt)
  );
}

/** Only the current active or retained facet emits its boon pulse and schedules the next eligible pulse. */
export function facetPulse(runtime: RevenantRuntime, data: unknown): void {
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
  const next = canonicalTime(runtime.time + canonicalInterval(skill.pulseInterval ?? 3));

  if (heraldFacetPassiveActive(runtime.profession.core, state, skillId, next))
    scheduleFacetPulse(runtime, skillId, next);
  else state.facetPulseReadyAt[skillId] = next;
}

/** An activated facet arms its consume and starts its own boon cadence at completion. */
export function startFacet(runtime: RevenantRuntime, skill: RevenantSkill): void {
  if (!skill.facet || !activeRevenantUpkeep(runtime, skill.id)) return;

  const core = runtime.profession.core;
  const state = heraldState.from(runtime);
  delete state.lingeringFacets[skill.id];
  const consumeId = revenantUpkeepConsumeId(skill, core.activeLegendId);

  if (consumeId != null) armSkillFlip(core.availableFlips, consumeId, runtime.time);

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
export function startConsume(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const facet = consumedFacet(runtime, cast);
  const wasActive = Boolean(facet && removeRevenantUpkeep(runtime, facet.id));
  runtime.resourceController.refresh('energy');
  consumeSkillFlip(runtime.profession.core.availableFlips, cast.skill.id);

  if (facet) consumedFacets.set(cast, { facet, wasActive });
}

/** The parent recharge and any Draconic Echo retention begin when the consume completes. */
export function completeConsume(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const consumed = consumedFacets.get(cast);
  consumedFacets.delete(cast);

  if (!consumed) return;

  const { facet, wasActive } = consumed;

  // Parent ownership makes Facet of Nature's cooldown shared by every legend-specific True Nature.
  if (cast.rechargeWork > 0) runtime.cooldownController.startRecharge(facet, runtime.time, cast.rechargeWork);

  runtime.fireTrigger(facetConsumed, { facet, wasActive, at: runtime.time });
}

/** Facet consumes require their armed follow-up, while active facets cannot be activated twice. */
export function heraldFacetAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: RevenantSkill
): AvailabilityResult {
  const core = runtime.profession.core;

  if (skill.consume && !skillFlipReady(core.availableFlips[skill.id], runtime.time))
    return denySkillCast(skill, 'revenant.facet-inactive', 'activate the matching facet first.');

  if (skill.facet && activeRevenantUpkeep(runtime, skill.id))
    return denySkillCast(skill, 'revenant.facet-active', 'the facet is already active; consume it instead.');

  return { ready: true };
}
