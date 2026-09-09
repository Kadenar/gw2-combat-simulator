import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/professions/thief/catalog/module-data.js';
import { thiefNativeModules } from '#gw2/professions/thief/modules.js';

export { thiefWeaponSkillMatchesSet };
export const thiefCatalog = assembleNativeApplicationCatalog(thiefNativeModules);
