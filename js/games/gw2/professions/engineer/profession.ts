import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  validateEngineerBuild
} from '#gw2/professions/engineer/build/build.js';
import { engineerNativeModules } from '#gw2/professions/engineer/catalog.js';
import { engineerWeaponSkillMatchesSet } from '#gw2/professions/engineer/build/weapon-matching.js';

export {
  ENGINEER_GENERATED_SKILL_IDS,
  engineerCatalog,
  engineerNativeModules
} from '#gw2/professions/engineer/catalog.js';

export const engineerProfession = defineNativeProfession({
  id: 'engineer',
  name: 'Engineer',
  build: {
    createBuildDefaults: createEngineerBuildDefaults,
    migrateBuild: migrateEngineerBuild,
    validateBuild: validateEngineerBuild
  },
  modules: engineerNativeModules,
  weaponSkillMatchesSet: engineerWeaponSkillMatchesSet
});

export default engineerProfession;
