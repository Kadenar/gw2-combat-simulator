import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild
} from '#gw2/professions/engineer/build/build.js';
import { engineerNativeModules } from '#gw2/professions/engineer/modules.js';
import { engineerFamilyUi } from '#gw2/professions/engineer/presentation.js';

export const engineerProfession = defineNativeProfession({
  id: 'engineer',
  name: 'Engineer',
  build: {
    createBuildDefaults: createEngineerBuildDefaults,
    migrateBuild: migrateEngineerBuild,
    validateBuild: validateEngineerBuild
  },
  modules: engineerNativeModules,
  presentation: engineerFamilyUi
});

export default engineerProfession;
