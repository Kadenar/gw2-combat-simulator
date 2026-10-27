/**
 * Declared activation costs. One owner decides affordability and spending for every profession, so a dodge or any
 * other priced skill waits for regeneration and pays its cost the same way everywhere.
 */
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';

/** Resolve fixed game rules or skill-owned tuning so admission and payment use the same amount. */
function skillCostAmount(skill: Skill): number {
  // Fixed costs share the same readiness and spending path without a patchable balance field.
  if (skill.cost!.amount != null) return skill.cost!.amount;

  // Read the authoritative authored field so patches affect admission and payment together.
  const field = skill.cost!.skillAmount;

  if (field != null) {
    const amount = skill[field];

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
      throw new TypeError(`Skill ${skill.id} has an invalid cost amount field "${field}".`);

    return amount;
  }

  return skill.resourceCost ?? 0;
}

/** Affordable now, a retry when regeneration will cover the cost, or a rejection when it never can. */
export function skillCostAvailability<T extends object>(
  runtime: MechanicQueryContext<T>,
  skill: Skill
): AvailabilityResult | null {
  if (!skill.cost) return null;

  const { resource } = skill.cost;
  const amount = skillCostAmount(skill);

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
  const amount = skillCostAmount(skill);

  if (skill.cost!.resource === 'endurance') runtime.endurance.spend(amount);
  else runtime.resourceController.spend(skill.cost!.resource, amount);
}
