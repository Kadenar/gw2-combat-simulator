/** Shared read of the selected skill's resource price for payment and eligibility. */
import type { Skill } from '#gw2/platform/skills/types.js';

/** Resolve fixed game rules or skill-owned tuning so admission and payment use the same amount. */
export function skillCostAmount(skill: Skill): number {
  if (!skill.cost) return 0;

  // Fixed costs share the same readiness and spending path without a patchable balance field.
  if (skill.cost.amount != null) return skill.cost.amount;

  // Read the authoritative authored field so patches affect admission and payment together.
  const field = skill.cost.skillAmount;

  if (field != null) {
    const amount = skill[field];

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)
      throw new TypeError(`Skill ${skill.id} has an invalid cost amount field "${field}".`);

    return amount;
  }

  return skill.resourceCost ?? 0;
}
