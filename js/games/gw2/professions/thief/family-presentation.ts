import { thiefWeaponSkillMatchesSet as thiefCoreWeaponSkillMatchesSet } from '#gw2/professions/thief/core/mechanics/weapon-state.js';
import { deadeyeWeaponSkillMatchesSet } from '#gw2/professions/thief/specializations/deadeye/mechanics/weapon-state.js';
import type { ThiefSkill, ThiefWeaponMatcherContext } from '#gw2/professions/thief/types.js';

/** Selects the active specialization's weapon matching policy for build validation and live palettes. */
export function thiefWeaponSkillMatchesSet(
  skill: ThiefSkill,
  pair: readonly (string | undefined)[] = [],
  context: ThiefWeaponMatcherContext = {}
): boolean {
  const specialization = context.specialization || context.config?.specialization || 'Core';
  if (specialization === 'Deadeye') return deadeyeWeaponSkillMatchesSet(skill, pair, context);
  // Family dispatch excludes Deadeye-owned malicious replacements from every other runtime.
  if (skill.stealthAttack && skill.malicious) return false;
  return thiefCoreWeaponSkillMatchesSet(skill, pair, context);
}
