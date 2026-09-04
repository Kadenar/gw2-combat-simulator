import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  validateElementalistBuild
} from '#gw2/professions/elementalist/build/build.js';
import {
  ELEMENTALIST_NATIVE_CATALOG_OPTIONS,
  elementalistNativeModules
} from '#gw2/professions/elementalist/modules.js';
import { elementalistFamilyUi } from '#gw2/professions/elementalist/presentation.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { observeElementalistAutoattackTransition } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';

/**
 * Family definition for the Elementalist: binds the build codec, the ordered native
 * modules, the autoattack-chain interruption policy, and the family UI contract into
 * the single profession object the engine and application shells consume.
 */
export const elementalistProfession = defineNativeProfession({
  id: 'elementalist',
  name: 'Elementalist',
  build: {
    createBuildDefaults: createElementalistBuildDefaults,
    migrateBuild: migrateElementalistBuild,
    validateBuild: validateElementalistBuild
  },
  modules: elementalistNativeModules,
  autoattackChains: {
    // Elementalist's explicit exceptions run before the shared damage-timing rule.
    overrides: [
      {
        // Aerial Agility is a timed slot-three flip, not an autoattack; only its
        // own expiry task closes the follow-up window during ordinary combat.
        id: 'elementalist.aerial-agility-flip-persists',
        chainRootIds: [ID.AERIAL_AGILITY],
        decision: 'preserve'
      },
      {
        id: 'elementalist.ride-the-lightning-preserves-sword',
        chainRootIds: [ID.FIRE_STRIKE, ID.SEICHE, ID.CHARGED_STRIKE, ID.CRYSTAL_SLASH],
        interruptingSkillIds: [ID.RIDE_THE_LIGHTNING],
        decision: 'preserve'
      }
    ],
    onTransition: observeElementalistAutoattackTransition
  },
  presentation: elementalistFamilyUi,
  catalog: ELEMENTALIST_NATIVE_CATALOG_OPTIONS
});

export default elementalistProfession;
