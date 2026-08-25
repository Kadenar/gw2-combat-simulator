import { defineNativeProfession } from '../../platform/gw2/authoring/profession.js';
import { activePatchPreview } from '../../patches/active-preview.js';
import { createGuardianBuildDefaults, migrateGuardianBuild, validateGuardianBuild } from './build.js';
import { guardianNativeModules } from './modules.js';

export const guardianProfession = defineNativeProfession({
  id: 'guardian',
  name: 'Guardian',
  build: {
    createBuildDefaults: createGuardianBuildDefaults,
    migrateBuild: migrateGuardianBuild,
    validateBuild: validateGuardianBuild
  },
  modules: guardianNativeModules,
  patchPreview: activePatchPreview
});

export default guardianProfession;
