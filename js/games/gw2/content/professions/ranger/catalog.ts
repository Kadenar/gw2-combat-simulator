import { assembleNativeApplicationCatalog } from '#gw2/integrations/patches/authoring/catalog.js';
import { rangerNativeModules } from '#gw2/content/professions/ranger/modules.js';

export const rangerCatalog = assembleNativeApplicationCatalog(rangerNativeModules);
