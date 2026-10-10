import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import { gainAffinity } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const UPKEEP_AFFINITY = 'revenant.conduit-upkeep-affinity';

/** Each committed Energy-costing legend or armed weapon cast builds affinity at acceptance. */
export function costAffinity(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  const cost = revenantEnergyCost(runtime, skill);
  if (!(cost > 0)) return;
  // Legend skills whose affinity is deferred to hit time are excluded to avoid double-granting.
  if (skill.legendId && !skill.affinityOnHit) gainAffinity(runtime, cost >= 25 ? 2 : 1);
  else runtime.fireTrigger(energyCostAccepted, { cast });
}

/** Upkeep cadences grant affinity and Impossible Odds' Assassin daggers while their activation remains. */
export function upkeepAffinity(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, startsAt } = data as { skillId: SkillId; startsAt: number };
  if (!activeRevenantUpkeep(runtime, skillId, startsAt) || !runtime.helpers.skillsById.has(skillId)) return;
  gainAffinity(runtime, 1);
  runtime.schedule(UPKEEP_AFFINITY, canonicalTime(runtime.time + 3), data, undefined, -200);
}

/** Positive-cost casts expose their captured skill after normal legend affinity admission. */
export const energyCostAccepted = defineTriggerPoint<{ readonly cast: RuntimeCast<RevenantSkill> }>(
  'revenant.energy-cost-accepted',
  [TRAIT.CONDUCTIVE_ARMAMENTS]
);
