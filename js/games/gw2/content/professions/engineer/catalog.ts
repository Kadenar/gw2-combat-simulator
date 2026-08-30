import { assembleNativeApplicationCatalog } from '../../../integrations/patches/authoring/catalog.js';
import { ENGINEER_GENERATED_SKILL_IDS } from './data/catalog.js';
import { engineerNativeModules } from './modules.js';

export { ENGINEER_GENERATED_SKILL_IDS };

export const engineerCatalog = assembleNativeApplicationCatalog(engineerNativeModules);
