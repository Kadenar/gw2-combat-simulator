import {
  assembleNativeApplicationCatalog,
  nativeSkillRuntimeOwner
} from '#gw2/platform/profession-definition/catalog.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/professions/thief/catalog/module-data.js';
import { thiefNativeModules } from '#gw2/professions/thief/modules.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export { thiefWeaponSkillMatchesSet };
export const thiefCatalog = assembleNativeApplicationCatalog(thiefNativeModules);
export function thiefSkillRuntimeOwner(skill: ThiefSkill): string {
  return nativeSkillRuntimeOwner(thiefNativeModules, skill);
}
