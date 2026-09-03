import { thiefWeaponSkillMatchesSet as thiefCoreWeaponSkillMatchesSet } from '#gw2/content/professions/thief/core/mechanics/weapon-state.js';
import type { ThiefSkill, ThiefWeaponMatcherContext } from '#gw2/content/professions/thief/types.js';

// Deadeye replaces every base stealth attack with its malicious counterpart before shared weapon matching runs.
export function deadeyeWeaponSkillMatchesSet(
  skill: ThiefSkill,
  pair: readonly (string | undefined)[] = [],
  context: ThiefWeaponMatcherContext = {}
): boolean {
  if (skill.stealthAttack && !skill.malicious) return false;
  return thiefCoreWeaponSkillMatchesSet(skill, pair, context);
}
