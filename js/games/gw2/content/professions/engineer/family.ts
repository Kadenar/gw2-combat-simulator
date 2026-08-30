import { defineNativeProfession } from '../../../integrations/patches/authoring/profession.js';
import { activePatchPreview } from '../../../integrations/patches/active-preview.js';
import { createEngineerBuildDefaults, migrateEngineerBuild, validateEngineerBuild } from './build/build.js';
import { engineerNativeModules } from './modules.js';
import { engineerFamilyUi } from './presentation.js';

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
