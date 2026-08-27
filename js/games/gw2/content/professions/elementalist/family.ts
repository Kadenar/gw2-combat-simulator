import { defineNativeProfession } from '../../../integrations/patches/authoring/profession.js';
import { activePatchPreview } from '../../../integrations/patches/active-preview.js';
import { createElementalistBuildDefaults, migrateElementalistBuild, validateElementalistBuild } from './build.js';
import { ELEMENTALIST_NATIVE_CATALOG_OPTIONS, elementalistNativeModules } from './modules.js';
import { elementalistFamilyUi } from './ui.js';
import { ELEMENTALIST_SKILL_IDS as ID } from './data/ids.js';
import { observeElementalistAutoattackTransition } from './core/weapon-state.js';

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
    // Elementalist resets on substantive casts, while chain-neutral metadata and
    // Ride the Lightning preserve only the sword roots that can coexist with its offhand dagger.
    overrides: [
      {
        // Aerial Agility is a timed slot-three flip, not an autoattack; only its
        // own expiry task closes the follow-up window during ordinary combat.
        id: 'elementalist.aerial-agility-flip-persists',
        chainRootIds: [ID.AERIAL_AGILITY],
        decision: 'preserve'
      },
      {
        id: 'elementalist.precommit-cancellation-preserves',
        when: ({ cast }) => cast.action?.cancelled === true,
        decision: 'preserve'
      },
      {
        id: 'elementalist.declared-chain-neutral',
        when: ({ interruptingSkill }) => interruptingSkill.preservesAutoattackChain === true,
        decision: 'preserve'
      },
      {
        id: 'elementalist.ride-the-lightning-preserves-sword',
        chainRootIds: [ID.FIRE_STRIKE, ID.SEICHE, ID.CHARGED_STRIKE, ID.CRYSTAL_SLASH],
        interruptingSkillIds: [ID.RIDE_THE_LIGHTNING],
        decision: 'preserve'
      },
      {
        id: 'elementalist.instant-casts-preserve',
        when: ({ interruptingSkill }) => Number(interruptingSkill.castTimeMs || 0) <= 0,
        decision: 'preserve'
      },
      {
        id: 'elementalist.substantive-casts-reset',
        when: ({ interruptingSkill }) => Number(interruptingSkill.castTimeMs || 0) > 0,
        decision: 'reset'
      }
    ],
    onTransition: observeElementalistAutoattackTransition
  },
  presentation: elementalistFamilyUi,
  patchPreview: activePatchPreview,
  catalog: ELEMENTALIST_NATIVE_CATALOG_OPTIONS
});

export default elementalistProfession;
