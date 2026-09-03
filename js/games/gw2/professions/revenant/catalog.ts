import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { revenantNativeModules } from '#gw2/professions/revenant/modules.js';

export const revenantCatalog = assembleNativeApplicationCatalog(revenantNativeModules);
