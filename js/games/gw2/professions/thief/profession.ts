import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { createThiefBuildDefaults, migrateThiefBuild, validateThiefBuild } from '#gw2/professions/thief/build/build.js';
import { thiefWeaponSkillMatchesSet } from '#gw2/professions/thief/build/weapon-matching.js';
import { thiefNativeModules } from '#gw2/professions/thief/catalog.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { observeThiefAutoattackTransition } from '#gw2/professions/thief/core/mechanics/weapon-state.js';

export { thiefCatalog, thiefNativeModules } from '#gw2/professions/thief/catalog.js';

export const thiefProfession = defineNativeProfession({
  id: 'thief',
  name: 'Thief',
  build: {
    createBuildDefaults: createThiefBuildDefaults,
    migrateBuild: migrateThiefBuild,
    validateBuild: validateThiefBuild
  },
  modules: thiefNativeModules,
  autoattackChains: {
    overrides: [
      {
        // Scepter keeps its pending bolt when other skills are used between autoattacks.
        id: 'thief.scepter-preserves-chain',
        chainRootIds: [ID.SHADOW_BOLT],
        decision: 'preserve'
      }
    ],
    onTransition: observeThiefAutoattackTransition
  },
  weaponSkillMatchesSet: thiefWeaponSkillMatchesSet
});

export default thiefProfession;
