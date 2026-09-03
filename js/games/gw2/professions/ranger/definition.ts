import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createRangerBuildDefaults,
  migrateRangerBuild,
  validateRangerBuild
} from '#gw2/professions/ranger/build/build.js';
import { rangerNativeModules } from '#gw2/professions/ranger/modules.js';

export const rangerProfession = defineNativeProfession({
  id: 'ranger',
  name: 'Ranger',
  build: {
    createBuildDefaults: createRangerBuildDefaults,
    migrateBuild: migrateRangerBuild,
    validateBuild: validateRangerBuild
  },
  modules: rangerNativeModules
});

export default rangerProfession;
