import { assembleNativeApplicationCatalog } from '#gw2/integrations/patches/authoring/catalog.js';
import { ENGINEER_GENERATED_SKILL_IDS } from '#gw2/content/professions/engineer/catalog/module-data.js';
import { engineerNativeModules } from '#gw2/content/professions/engineer/modules.js';

export { ENGINEER_GENERATED_SKILL_IDS };

export const engineerCatalog = assembleNativeApplicationCatalog(engineerNativeModules);
