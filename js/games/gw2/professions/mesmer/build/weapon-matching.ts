import { defaultWeaponSkillMatchesSet } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { NON_MIRAGE_AXE_SKILL_IDS } from '#gw2/professions/mesmer/data/module-data.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2WeaponMatcherContext } from '#gw2/platform/equipment/weapons/types.js';

/** Excludes shared weapon skills when the active specialization replaces them. */
export function mesmerWeaponSkillMatchesSet(
  skill: Skill,
  weapons: readonly (string | undefined)[] = [],
  context: Gw2WeaponMatcherContext = {}
): boolean {
  const specialization =
    context.specialization || context.config?.specialization || context.build?.specialization || 'Core';
  if (specialization === 'Mirage' && NON_MIRAGE_AXE_SKILL_IDS.has(skill.id)) return false;
  if (specialization === 'Virtuoso' && skill.id === ID.BLADECALL_NON_VIRTUOSO) return false;
  return defaultWeaponSkillMatchesSet(skill, weapons, context);
}
