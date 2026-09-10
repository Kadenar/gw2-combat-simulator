import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { guardianNativeModules } from '#gw2/professions/guardian/modules.js';

export const guardianCatalog = assembleNativeApplicationCatalog(guardianNativeModules);
