/**
 * Declared activation costs. One owner decides affordability and spending for every profession, so a dodge or any
 * other priced skill waits for regeneration and pays its cost the same way everywhere.
 */
import { EPSILON } from '#kernel/core/clock.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';

/** Resolves the declared amount from the selected balance data at the moment it is read. */
function skillCostAmount(runtime: Pick<MechanicQueryContext, 'helpers'>, skill: Skill): number {
  const source = skill.cost!.profileAmount;
  return source
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, source.profileId), source.field)
    : (skill.resourceCost ?? 0);
}

/** Affordable now, a retry when regeneration will cover the cost, or a rejection when it never can. */
export function skillCostAvailability<T extends object>(
  runtime: MechanicQueryContext<T>,
  skill: Skill
): AvailabilityResult | null {
  if (!skill.cost) return null;
  const { resource } = skill.cost;
  const amount = skillCostAmount(runtime, skill);
  const readyAt =
    resource === 'endurance' ? runtime.endurance.readyAt(amount) : runtime.resourceController.readyAt(resource, amount);
  if (readyAt != null && readyAt <= runtime.time + EPSILON) return null;
  return denySkillCast(
    skill,
    `gw2.insufficient-${resource}`,
    `requires ${amount} ${resource}.`,
    readyAt != null && Number.isFinite(readyAt) ? readyAt : null
  );
}

/** Pays the declared cost from the live pool. */
export function spendSkillCost<T extends object>(runtime: MechanicContext<T>, skill: Skill): void {
  const amount = skillCostAmount(runtime, skill);
  if (skill.cost!.resource === 'endurance') runtime.endurance.spend(amount);
  else runtime.resourceController.spend(skill.cost!.resource, amount);
}
