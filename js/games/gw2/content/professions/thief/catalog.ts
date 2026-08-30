import {
  assembleNativeApplicationCatalog,
  nativeSkillRuntimeOwner
} from '../../../integrations/patches/authoring/catalog.js';
import { thiefWeaponSkillMatchesSet } from './data/catalog.js';
import { thiefNativeModules } from './modules.js';
import type { ThiefSkill } from './types.js';

export { thiefWeaponSkillMatchesSet };
export const thiefCatalog = assembleNativeApplicationCatalog(thiefNativeModules);
export function thiefSkillRuntimeOwner(skill: ThiefSkill): string {
  return nativeSkillRuntimeOwner(thiefNativeModules, skill);
}
