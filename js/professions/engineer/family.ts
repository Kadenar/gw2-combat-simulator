import { defineNativeProfession } from '../../platform/gw2/native-profession.js';
import { activePatchPreview } from '../../patches/active-preview.js';
import { createEngineerBuildDefaults, migrateEngineerBuild, validateEngineerBuild } from './build.js';
import './data/trait-coverage.js';
import { engineerNativeModules } from './modules.js';
import { engineerFamilyUi } from './ui.js';

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
