import { rangerWeaponSkillMatchesSet } from '#gw2/professions/ranger/build/weapon-matching.js';
import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createRangerBuildDefaults,
  migrateRangerBuild,
  validateRangerBuild
} from '#gw2/professions/ranger/build/build.js';
import { rangerNativeModules } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

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
  modules: rangerNativeModules,
  autoattackChains: {
    overrides: [
      {
        // Entangle restarts the dagger chain even though its roots deal damage after the cast ends.
        id: 'ranger.entangle-resets-dagger-chain',
        chainRootIds: [ID.GROUNDWORK_GOUGE],
        interruptingSkillIds: [ID.ENTANGLE],
        decision: 'reset'
      }
    ]
  }
});
