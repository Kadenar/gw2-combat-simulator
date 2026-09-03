import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { NECROMANCER_NON_DPS_SKILL_NAMES } from '#gw2/professions/necromancer/catalog/module-data.js';
import { necromancerNativeModules } from '#gw2/professions/necromancer/modules.js';

export { NECROMANCER_NON_DPS_SKILL_NAMES };
export const necromancerCatalog = assembleNativeApplicationCatalog(necromancerNativeModules);
