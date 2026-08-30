import { defineNativeProfession } from '../../../integrations/patches/authoring/profession.js';
import { activePatchPreview } from '../../../integrations/patches/active-preview.js';
import { createWarriorBuildDefaults, migrateWarriorBuild, validateWarriorBuild } from './build/build.js';
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
