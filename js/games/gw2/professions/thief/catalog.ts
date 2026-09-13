import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { thiefNativeModules } from '#gw2/professions/thief/modules.js';

export const thiefCatalog = assembleNativeApplicationCatalog(thiefNativeModules);
