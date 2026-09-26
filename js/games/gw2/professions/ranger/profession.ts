import { rangerWeaponSkillMatchesSet } from '#gw2/professions/ranger/build/weapon-matching.js';
import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createRangerBuildDefaults,
  migrateRangerBuild,
  validateRangerBuild
} from '#gw2/professions/ranger/build/build.js';
import { rangerNativeModules } from '#gw2/professions/ranger/catalog.js';

export { rangerCatalog, rangerNativeModules } from '#gw2/professions/ranger/catalog.js';

export const rangerProfession = defineNativeProfession({
  id: 'ranger',
  name: 'Ranger',
  requireEquippedSlotSkills: true,
  build: {
    createBuildDefaults: createRangerBuildDefaults,
    migrateBuild: migrateRangerBuild,
    validateBuild: validateRangerBuild
  },
  weaponSkillMatchesSet: rangerWeaponSkillMatchesSet,
  modules: rangerNativeModules
});

export default rangerProfession;
