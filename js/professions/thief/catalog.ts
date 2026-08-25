import { assembleNativeApplicationCatalog, nativeSkillRuntimeOwner } from '../../platform/gw2/authoring/catalog.js';
import { thiefWeaponSkillMatchesSet } from './catalog-data.js';
import { thiefNativeModules } from './modules.js';
import type { ThiefSkill } from './types.js';

export { thiefWeaponSkillMatchesSet };
export const thiefCatalog = assembleNativeApplicationCatalog(thiefNativeModules);
export const THIEF_SKILLS = thiefCatalog.skills;
export function thiefSkillRuntimeOwner(skill: ThiefSkill): string {
  return nativeSkillRuntimeOwner(thiefNativeModules, skill);
}
