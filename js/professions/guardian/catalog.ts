import { assembleNativeApplicationCatalog, nativeSkillRuntimeOwner } from '../../platform/gw2/authoring/catalog.js';
import { GUARDIAN_NON_DPS_SKILL_NAMES } from './catalog-data.js';
import { guardianNativeModules } from './modules.js';
import type { GuardianSkill } from './types.js';

export { GUARDIAN_NON_DPS_SKILL_NAMES };

export const guardianCatalog = assembleNativeApplicationCatalog(guardianNativeModules);
export const GUARDIAN_SKILLS = guardianCatalog.skills;

export function guardianSkillRuntimeOwner(skill: GuardianSkill): string {
  return nativeSkillRuntimeOwner(guardianNativeModules, skill);
}
