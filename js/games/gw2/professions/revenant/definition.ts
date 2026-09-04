import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild
} from '#gw2/professions/revenant/build/build.js';
import { revenantNativeModules } from '#gw2/professions/revenant/modules.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

export const revenantProfession = defineNativeProfession({
  id: 'revenant',
  name: 'Revenant',
  build: {
    createBuildDefaults: createRevenantBuildDefaults,
    migrateBuild: migrateRevenantBuild,
    validateBuild: validateRevenantBuild
  },
  modules: revenantNativeModules,
  autoattackChains: {
    overrides: [
      {
        id: 'revenant.dodge-resets',
        interruptingSkillIds: [ID.DODGE],
        decision: 'reset'
      },
      {
        id: 'revenant.beguiling-haze-resets',
        when: ({ interruptingSkill }) => interruptingSkill.handlerId === 'revenant.beguiling-haze',
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

export default revenantProfession;
