/**
 * Declared activation costs. One owner decides affordability and spending for every profession, so a dodge or any
 * other priced skill waits for regeneration and pays its cost the same way everywhere.
 */
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Affordable now, a retry when regeneration will cover the cost, or a rejection when it never can. */
export function skillCostAvailability<T extends object>(
  runtime: MechanicQueryContext<T>,
  skill: Skill
): AvailabilityResult | null {
  if (!skill.cost) return null;

  const { resource, amount } = skill.cost;

  // Free skills need no pool readiness and remain valid when recovery is disabled.
  if (amount === 0) return null;

  const readyAt =
    resource === 'endurance' ? runtime.endurance.readyAt(amount) : runtime.resourceController.readyAt(resource, amount);

  // Resource owners decide affordability; a future deadline cannot fund the current activation.
  if (readyAt != null && readyAt <= runtime.time) return null;

  return denySkillCast(
    skill,
    `gw2.insufficient-${resource}`,
    `requires ${amount} ${resource}.`,
    readyAt != null && Number.isFinite(readyAt) ? readyAt : null
  );
}

/** Pays the declared cost from the live pool. */
export function spendSkillCost<T extends object>(runtime: MechanicContext<T>, skill: Skill): void {
  const { resource, amount } = skill.cost!;

  if (resource === 'endurance') runtime.endurance.spend(amount);
  else runtime.resourceController.spend(resource, amount);
}
