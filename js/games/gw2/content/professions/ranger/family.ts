import { defineNativeProfession } from '../../../integrations/patches/authoring/profession.js';
import { activePatchPreview } from '../../../integrations/patches/active-preview.js';
import { createRangerBuildDefaults, migrateRangerBuild, validateRangerBuild } from './build.js';
import { rangerNativeModules } from './modules.js';

export const rangerProfession = defineNativeProfession({
  id: 'ranger',
  name: 'Ranger',
  build: {
    createBuildDefaults: createRangerBuildDefaults,
    migrateBuild: migrateRangerBuild,
    validateBuild: validateRangerBuild
  },
  modules: rangerNativeModules,
  patchPreview: activePatchPreview
});

export default rangerProfession;
