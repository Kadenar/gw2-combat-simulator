import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';

const NON_HOLOSMITH_SWORD_SKILL_IDS = new Set<SkillId>([
  ID.RADIANT_ARC_NON_HOLOSMITH,
  ID.SUN_RIPPER_NON_HOLOSMITH,
  ID.SUN_EDGE_NON_HOLOSMITH,
  ID.GLEAM_SABER_NON_HOLOSMITH,
  ID.REFRACTION_CUTTER_NON_HOLOSMITH
]);

/** Selects the active sword identity at the Engineer family boundary. */
export function engineerWeaponSkillMatchesSet(
  skill: Skill,
  weapons: readonly (string | undefined)[] = [],
  context: Gw2WeaponMatcherContext = {}
): boolean {
  const specialization = String(
    context.specialization || context.config?.specialization || context.build?.specialization || 'Core'
  );
  if (specialization === 'Holosmith' && NON_HOLOSMITH_SWORD_SKILL_IDS.has(skill.id)) return false;
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}
