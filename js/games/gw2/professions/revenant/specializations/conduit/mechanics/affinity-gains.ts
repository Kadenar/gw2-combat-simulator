import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/energy-cost.js';
import { gainAffinity } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/**
 * Each committed Energy-costing legend or armed weapon cast builds affinity when its Energy is spent. A cast that pays
 * at commit passes the cost captured at cast start, because the cast can change its own cost before it commits.
 */
export function costAffinity(
  runtime: RevenantRuntime,
  cast: RuntimeCast<RevenantSkill>,
  cost = revenantEnergyCost(runtime, cast.skill)
): void {
  const skill = cast.skill;

  // A cast cancelled before its commit builds no affinity, even when it paid its Energy at cast start.
  if (cast.cancelledBeforeCommit || !(cost > 0)) return;

  // Legend skills whose affinity is deferred to hit time are excluded to avoid double-granting.
  if (skill.legendId && !skill.affinityOnHit) gainAffinity(runtime, cost >= 25 ? 2 : 1);
  else runtime.fireTrigger(energyCostAccepted, { cast });
}

/** Positive-cost casts expose their captured skill after normal legend affinity admission. */
export const energyCostAccepted = defineTriggerPoint<{ readonly cast: RuntimeCast<RevenantSkill> }>(
  'revenant.energy-cost-accepted',
  [TRAIT.CONDUCTIVE_ARMAMENTS]
);
