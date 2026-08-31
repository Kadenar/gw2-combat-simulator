import { defineNativeProfession } from '#gw2/integrations/patches/authoring/profession.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild
} from '#gw2/content/professions/engineer/build/build.js';
import { engineerNativeModules } from '#gw2/content/professions/engineer/modules.js';
import { engineerFamilyUi } from '#gw2/content/professions/engineer/presentation.js';

export const engineerProfession = defineNativeProfession({
  id: 'engineer',
  name: 'Engineer',
  build: {
    createBuildDefaults: createEngineerBuildDefaults,
    migrateBuild: migrateEngineerBuild,
    validateBuild: validateEngineerBuild
  },
  modules: engineerNativeModules,
  presentation: engineerFamilyUi,
  patchPreview: activePatchPreview
});

export default engineerProfession;
