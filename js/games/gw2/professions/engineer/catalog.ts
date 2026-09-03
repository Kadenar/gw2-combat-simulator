import { assembleNativeApplicationCatalog } from '#gw2/platform/profession-definition/catalog.js';
import { ENGINEER_GENERATED_SKILL_IDS } from '#gw2/professions/engineer/catalog/module-data.js';
import { engineerNativeModules } from '#gw2/professions/engineer/modules.js';

export { ENGINEER_GENERATED_SKILL_IDS };

export const engineerCatalog = assembleNativeApplicationCatalog(engineerNativeModules);
