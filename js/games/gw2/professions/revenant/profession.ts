import { defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild
} from '#gw2/professions/revenant/build/build.js';
import { revenantNativeModules } from '#gw2/professions/revenant/catalog.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';

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
  autoattackChains: {
    overrides: [
      {
        id: 'revenant.dodge-resets',
        interruptingSkillIds: [ID.DODGE],
        decision: 'reset'
      },
      {
        id: 'revenant.jump-preserves-airborne-chain',
        interruptingSkillIds: [VINDICATOR_JUMP_SKILL.id],
        decision: 'preserve'
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

// Integration exports: log rotation reconstruction reads these without reaching into module internals.
export { beguilingHazeCastDuration } from '#gw2/professions/revenant/specializations/conduit/mechanics/beguiling-haze.js';
export { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';
export {
  VINDICATOR_AIRBORNE_MS,
  VINDICATOR_JUMP_SKILL
} from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
