import { defineNativeProfession } from '../../../integrations/patches/authoring/profession.js';
import { activePatchPreview } from '../../../integrations/patches/active-preview.js';
import { createThiefBuildDefaults, migrateThiefBuild, validateThiefBuild } from './build.js';
import { thiefWeaponSkillMatchesSet } from './catalog-data.js';
import { thiefNativeModules } from './modules.js';

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
