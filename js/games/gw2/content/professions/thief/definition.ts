import { defineNativeProfession } from '#gw2/integrations/patches/authoring/profession.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import {
  createThiefBuildDefaults,
  migrateThiefBuild,
  validateThiefBuild
} from '#gw2/content/professions/thief/build/build.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/content/professions/thief/catalog/module-data.js';
import { thiefNativeModules } from '#gw2/content/professions/thief/modules.js';

export const thiefProfession = defineNativeProfession({
  id: 'thief',
  name: 'Thief',
  build: {
    createBuildDefaults: createThiefBuildDefaults,
    migrateBuild: migrateThiefBuild,
    validateBuild: validateThiefBuild
  },
  modules: thiefNativeModules,
  patchPreview: activePatchPreview,
  presentation: {
    weaponSkillMatchesSet: thiefWeaponSkillMatchesSet
  }
});

export default thiefProfession;
