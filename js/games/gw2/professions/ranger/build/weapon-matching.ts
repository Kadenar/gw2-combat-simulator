import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';
import { isRangerHammerVariant, rangerHammerSkillIds } from '#gw2/professions/ranger/data/hammer-variants.js';

/** Casts and weapon previews share the selected or unleash-driven hammer bar. */
export function rangerWeaponSkillMatchesSet(
  skill: Skill,
  weapons: readonly (string | undefined)[] = [],
  context: Gw2WeaponMatcherContext & { readonly config?: RangerConfig } = {}
): boolean {
  if (isRangerHammerVariant(skill.id) && !rangerHammerSkillIds(context).includes(Number(skill.id))) return false;
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}
