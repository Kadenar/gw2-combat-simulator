import { assembleNativeApplicationCatalog } from '#gw2/integrations/patches/authoring/catalog.js';
import { NECROMANCER_NON_DPS_SKILL_NAMES } from '#gw2/content/professions/necromancer/catalog/module-data.js';
import { necromancerNativeModules } from '#gw2/content/professions/necromancer/modules.js';

export { NECROMANCER_NON_DPS_SKILL_NAMES };
export const necromancerCatalog = assembleNativeApplicationCatalog(necromancerNativeModules);
