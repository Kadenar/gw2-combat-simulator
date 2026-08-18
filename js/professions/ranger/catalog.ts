import { assembleNativeApplicationCatalog, nativeSkillRuntimeOwner } from '../../platform/gw2/native-profession.js';
import { rangerNativeModules } from './modules.js';
import type { RangerSkill } from './types.js';

export const RANGER_ELITE_SPECIALIZATIONS = Object.freeze(['Druid', 'Soulbeast', 'Untamed', 'Galeshot']);
export const rangerCatalog = assembleNativeApplicationCatalog(rangerNativeModules);
export const RANGER_SKILLS = rangerCatalog.skills;

export function rangerSkillRuntimeOwner(skill: RangerSkill): string {
  return nativeSkillRuntimeOwner(rangerNativeModules, skill);
}
