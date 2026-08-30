import {
  assembleNativeApplicationCatalog,
  nativeSkillRuntimeOwner
} from '#gw2/integrations/patches/authoring/catalog.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/content/professions/thief/catalog/module-data.js';
import { thiefNativeModules } from '#gw2/content/professions/thief/modules.js';
import type { ThiefSkill } from '#gw2/content/professions/thief/types.js';

export { thiefWeaponSkillMatchesSet };
export const thiefCatalog = assembleNativeApplicationCatalog(thiefNativeModules);
export function thiefSkillRuntimeOwner(skill: ThiefSkill): string {
  return nativeSkillRuntimeOwner(thiefNativeModules, skill);
}
