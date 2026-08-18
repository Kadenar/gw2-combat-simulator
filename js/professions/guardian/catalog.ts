import { assembleNativeApplicationCatalog, nativeSkillRuntimeOwner } from '../../platform/gw2/native-profession.js';
import { GUARDIAN_NON_DPS_SKILL_NAMES } from './catalog-data.js';
import { guardianNativeModules } from './modules.js';
import type { GuardianSkill } from './types.js';

export { GUARDIAN_NON_DPS_SKILL_NAMES };

export const GUARDIAN_ELITE_SPECIALIZATIONS = Object.freeze(['Dragonhunter', 'Firebrand', 'Willbender', 'Luminary']);

export const guardianCatalog = assembleNativeApplicationCatalog(guardianNativeModules);
export const GUARDIAN_SKILLS = guardianCatalog.skills;

export function guardianSkillRuntimeOwner(skill: GuardianSkill): string {
  return nativeSkillRuntimeOwner(guardianNativeModules, skill);
}
