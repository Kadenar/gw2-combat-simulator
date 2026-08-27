import { assembleNativeApplicationCatalog } from '../../../integrations/patches/authoring/catalog.js';
import { GUARDIAN_NON_DPS_SKILL_NAMES } from './catalog-data.js';
import { guardianNativeModules } from './modules.js';

export { GUARDIAN_NON_DPS_SKILL_NAMES };

export const guardianCatalog = assembleNativeApplicationCatalog(guardianNativeModules);
