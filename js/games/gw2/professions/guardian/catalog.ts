import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { GUARDIAN_NON_DPS_SKILL_NAMES } from '#gw2/professions/guardian/catalog/module-data.js';
import { guardianNativeModules } from '#gw2/professions/guardian/modules.js';

export { GUARDIAN_NON_DPS_SKILL_NAMES };

export const guardianCatalog = assembleNativeApplicationCatalog(guardianNativeModules);
