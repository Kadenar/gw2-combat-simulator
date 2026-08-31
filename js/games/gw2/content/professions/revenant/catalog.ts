import { assembleNativeApplicationCatalog } from '#gw2/integrations/patches/authoring/catalog.js';
import { revenantNativeModules } from '#gw2/content/professions/revenant/modules.js';

export const revenantCatalog = assembleNativeApplicationCatalog(revenantNativeModules);
