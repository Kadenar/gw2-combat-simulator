import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { MESMER_NATIVE_CATALOG_OPTIONS } from '#gw2/professions/mesmer/catalog/module-data.js';
import { mesmerNativeModules } from '#gw2/professions/mesmer/modules.js';

export const mesmerCatalog = assembleNativeApplicationCatalog(mesmerNativeModules, MESMER_NATIVE_CATALOG_OPTIONS);
