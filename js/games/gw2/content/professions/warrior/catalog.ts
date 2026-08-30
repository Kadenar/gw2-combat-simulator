import { assembleNativeApplicationCatalog } from '#gw2/integrations/patches/authoring/catalog.js';
import { warriorNativeModules } from '#gw2/content/professions/warrior/modules.js';

export const warriorCatalog = assembleNativeApplicationCatalog(warriorNativeModules);
