import { defineNativeProfession } from '../../../integrations/patches/authoring/profession.js';
import { activePatchPreview } from '../../../integrations/patches/active-preview.js';
import { createRevenantBuildDefaults, migrateRevenantBuild, validateRevenantBuild } from './build.js';
import { revenantNativeModules } from './modules.js';
import { REVENANT_SKILL_IDS as ID } from './data/ids.js';

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
        // Revenant's explicit interruption rules apply only after the
        // interrupting action commits, matching its former lifecycle guard.
        id: 'revenant.precommit-cancellation-preserves',
        when: ({ cast }) => cast.action?.cancelled === true,
        decision: 'preserve'
      },
      {
        // Temporal Rift is chain-neutral only for the Mace sequence it accompanies.
        id: 'revenant.temporal-rift-preserves-mace',
        chainRootIds: [ID.MISERY_SWIPE],
        interruptingSkillIds: [ID.TEMPORAL_RIFT],
        decision: 'preserve'
      },
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
  },
  patchPreview: activePatchPreview
});

export default revenantProfession;
