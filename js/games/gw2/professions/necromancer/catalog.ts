import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { necromancerNativeModules } from '#gw2/professions/necromancer/modules.js';

export const necromancerCatalog = assembleNativeApplicationCatalog(necromancerNativeModules);
