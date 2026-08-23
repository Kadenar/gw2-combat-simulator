import { defineNativeProfession } from '../../platform/gw2/native-profession.js';
import { activePatchPreview } from '../../patches/active-preview.js';
import { createWarriorBuildDefaults, migrateWarriorBuild, validateWarriorBuild } from './build.js';
import { warriorNativeModules } from './modules.js';

export const warriorProfession = defineNativeProfession({
  id: 'warrior',
  name: 'Warrior',
  build: {
    createBuildDefaults: createWarriorBuildDefaults,
    migrateBuild: migrateWarriorBuild,
    validateBuild: validateWarriorBuild
  },
  modules: warriorNativeModules,
  patchPreview: activePatchPreview
});

export default warriorProfession;
