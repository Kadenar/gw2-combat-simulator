import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Shares build eligibility across selectors, palette, and casts; Weaponmaster Training is always active. */
export function isBuildSkillAvailable(
  skill: Skill,
  { specialization }: { readonly specialization?: string } = {}
): boolean {
  if (skill.simulatorExcluded) return false;
  if (skill.type === 'Weapon') return true;
  return !skill.specialization || skill.specialization === specialization;
}
