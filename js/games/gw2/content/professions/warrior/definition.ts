import { defineNativeProfession } from '#gw2/integrations/patches/authoring/profession.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import {
  createWarriorBuildDefaults,
  migrateWarriorBuild,
  validateWarriorBuild
} from '#gw2/content/professions/warrior/build/build.js';
import { warriorNativeModules } from '#gw2/content/professions/warrior/modules.js';

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
