import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild
} from '#gw2/professions/revenant/build/build.js';
import { revenantNativeModules } from '#gw2/professions/revenant/catalog.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { vindicatorReworkModule } from '#gw2/professions/revenant/specializations/vindicator/rework/module.js';

export { revenantCatalog, revenantNativeModules } from '#gw2/professions/revenant/catalog.js';

export const revenantProfession = defineNativeProfession({
  id: 'revenant',
  name: 'Revenant',
  build: {
    createBuildDefaults: createRevenantBuildDefaults,
    migrateBuild: migrateRevenantBuild,
    validateBuild: validateRevenantBuild
  },
  modules: revenantNativeModules,
  moduleVariants: { 'vindicator-rework': vindicatorReworkModule },
  autoattackChains: {
    overrides: [
      {
        // Shared execution resets on completion or cancellation, leaving airborne autos available until Dodge ends.
        id: 'revenant.dodge-resets',
        interruptingSkillIds: [SHARED_SKILL_IDS.DODGE],
        decision: 'reset'
      },
      {
        id: 'revenant.beguiling-haze-resets',
        interruptingSkillIds: [ID.BEGUILING_HAZE],
        decision: 'reset'
      },
      {
        id: 'revenant.citadel-bombardment-resets',
        interruptingSkillIds: [ID.CITADEL_BOMBARDMENT],
        decision: 'reset'
      }
    ]
  }
});
