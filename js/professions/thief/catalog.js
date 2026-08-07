import {
  assembleNativeApplicationCatalog,
  nativeSkillRuntimeOwner,
} from "../../platform/gw2/native-profession.js";
import { thiefWeaponSkillMatchesSet } from "./catalog-data.js";
import { thiefNativeModules } from "./modules.js";

export { thiefWeaponSkillMatchesSet };
export const THIEF_ELITE_SPECIALIZATIONS = Object.freeze([
  "Daredevil", "Deadeye", "Specter", "Antiquary",
]);
export const thiefCatalog = assembleNativeApplicationCatalog(thiefNativeModules);
export const THIEF_SKILLS = thiefCatalog.skills;
export function thiefSkillRuntimeOwner(skill) {
  return nativeSkillRuntimeOwner(thiefNativeModules, skill);
}
