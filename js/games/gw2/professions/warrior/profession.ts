import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createWarriorBuildDefaults,
  migrateWarriorBuild,
  validateWarriorBuild
} from '#gw2/professions/warrior/build/build.js';
import { warriorNativeModules } from '#gw2/professions/warrior/catalog.js';
import { WARRIOR_NATIVE_CATALOG_OPTIONS } from '#gw2/professions/warrior/data/module-data.js';

export { warriorCatalog, warriorNativeModules } from '#gw2/professions/warrior/catalog.js';

export const warriorProfession = defineNativeProfession({
  id: 'warrior',
  name: 'Warrior',
  build: {
    createBuildDefaults: createWarriorBuildDefaults,
    migrateBuild: migrateWarriorBuild,
    validateBuild: validateWarriorBuild
  },
  modules: warriorNativeModules,
  catalog: WARRIOR_NATIVE_CATALOG_OPTIONS
});

export default warriorProfession;
