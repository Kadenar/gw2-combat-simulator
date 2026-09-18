import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';
import type { RangerConfig } from '#gw2/professions/ranger/types.js';
import { isRangerHammerVariant, normalizeRangerHammerSkillIds } from '#gw2/professions/ranger/data/hammer-variants.js';

/** Keeps only build-selected hammer variants eligible for both casts and weapon-bar previews. */
export function rangerWeaponSkillMatchesSet(
  skill: Skill,
  weapons: readonly (string | undefined)[] = [],
  context: Gw2WeaponMatcherContext & { readonly config?: RangerConfig } = {}
): boolean {
  if (
    isRangerHammerVariant(skill.id) &&
    !normalizeRangerHammerSkillIds(
      context.build?.selectedHammerSkillIds || context.config?.selectedHammerSkillIds
    ).includes(Number(skill.id))
  )
    return false;
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}
