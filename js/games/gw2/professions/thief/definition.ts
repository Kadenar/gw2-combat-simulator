import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { createThiefBuildDefaults, migrateThiefBuild, validateThiefBuild } from '#gw2/professions/thief/build/build.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/professions/thief/catalog/module-data.js';
import { thiefNativeModules } from '#gw2/professions/thief/modules.js';

export const thiefProfession = defineNativeProfession({
  id: 'thief',
  name: 'Thief',
  build: {
    createBuildDefaults: createThiefBuildDefaults,
    migrateBuild: migrateThiefBuild,
    validateBuild: validateThiefBuild
  },
  modules: thiefNativeModules,
  presentation: {
    weaponSkillMatchesSet: thiefWeaponSkillMatchesSet
  }
});

export default thiefProfession;
