import { assembleNativeApplicationCatalog } from '#gw2/integrations/patches/authoring/catalog.js';
import { GUARDIAN_NON_DPS_SKILL_NAMES } from '#gw2/content/professions/guardian/catalog/module-data.js';
import { guardianNativeModules } from '#gw2/content/professions/guardian/modules.js';

export { GUARDIAN_NON_DPS_SKILL_NAMES };

export const guardianCatalog = assembleNativeApplicationCatalog(guardianNativeModules);
