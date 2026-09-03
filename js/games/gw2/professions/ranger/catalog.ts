import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { rangerNativeModules } from '#gw2/professions/ranger/modules.js';

export const rangerCatalog = assembleNativeApplicationCatalog(rangerNativeModules);
