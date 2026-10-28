import { WEAPON } from '#gw2/platform/constants.js';
import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { NON_HOLOSMITH_SWORD_SKILL_IDS } from '#gw2/professions/engineer/data/module-data.js';

/** Selects the active sword identity at the Engineer family boundary. */
export function engineerWeaponSkillMatchesSet(
  skill: Skill,
  weapons: readonly (string | undefined)[] = [],
  context: Gw2WeaponMatcherContext = {}
): boolean {
  const specialization = context.specialization || context.config?.specialization || 'Core';

  if (specialization === 'Holosmith' && NON_HOLOSMITH_SWORD_SKILL_IDS.has(skill.id)) return false;

  // Other elites use Core's sword identities; heat-aware variants are absent from their runtime catalogs.
  if (specialization !== 'Holosmith' && skill.weapon === WEAPON.SWORD && skill.specialization === 'Holosmith')
    return false;

  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}
