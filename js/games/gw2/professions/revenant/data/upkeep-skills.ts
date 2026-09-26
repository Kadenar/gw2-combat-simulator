import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';

/** Upkeeps are the skills that declare a sustained Energy drain. */
export function isRevenantUpkeep(skill: Skill | null | undefined): boolean {
  return skill?.upkeepCost != null;
}

/**
 * A release is the free flip of an upkeep parent; facet consumes are Herald-owned instead. Callers supply their own
 * catalog lookup so live owners, the palette, and log reconstruction share one identity rule.
 */
export function isRevenantUpkeepRelease(
  skill: Skill | null | undefined,
  skillFor: (id: SkillId) => Skill | null | undefined
): boolean {
  if (!skill || skill.consume || skill.flipParentId == null) return false;
  return isRevenantUpkeep(skillFor(Number(skill.flipParentId)));
}
