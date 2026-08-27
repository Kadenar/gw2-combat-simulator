import { assembleNativeApplicationCatalog } from '../../platform/gw2/authoring/catalog.js';
import { NECROMANCER_NON_DPS_SKILL_NAMES } from './catalog-data.js';
import { necromancerNativeModules } from './modules.js';

export { NECROMANCER_NON_DPS_SKILL_NAMES };
export const necromancerCatalog = assembleNativeApplicationCatalog(necromancerNativeModules);
