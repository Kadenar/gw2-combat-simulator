import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { warriorNativeModules } from '#gw2/professions/warrior/modules.js';
import { WARRIOR_NATIVE_CATALOG_OPTIONS } from '#gw2/professions/warrior/catalog/module-data.js';

export const warriorCatalog = assembleNativeApplicationCatalog(warriorNativeModules, WARRIOR_NATIVE_CATALOG_OPTIONS);
