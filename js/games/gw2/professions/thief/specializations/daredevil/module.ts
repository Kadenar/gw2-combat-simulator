import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { applyWeakeningStrike } from '#gw2/professions/thief/specializations/daredevil/traits/index.js';
import { createThiefModuleData } from '#gw2/professions/thief/catalog/module-data.js';
import {
  daredevilAttributeRules,
  daredevilCastRules,
  daredevilSchedulerHooks
} from '#gw2/professions/thief/specializations/daredevil/mechanics/dodge-rules.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { DAREDEVIL_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/daredevil/skills/index.js';
import { DAREDEVIL_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/daredevil/profiles.js';
import { daredevilUi } from '#gw2/professions/thief/specializations/daredevil/presentation.js';

export const daredevilModule = defineNativeModule({
  id: 'Daredevil',
  data: createThiefModuleData('Daredevil', {
    skillMechanics: DAREDEVIL_SKILL_MECHANICS,
    balanceProfiles: DAREDEVIL_BALANCE_PROFILES
  }),
  // Scheduler and resolver each get their own independent DaredevilState instance
  state: { scheduler: daredevilState.create, resolver: daredevilState.create },
  mechanics: {
    // Weakness follows the hit that consumes the post-dodge buff.
    resolution: {
      reactions: [onResolvedDamage({ id: 'thief.weakening-strikes', order: 40, handler: applyWeakeningStrike })]
    },
    modifiers: daredevilAttributeRules,
    execution: {
      castRules: daredevilCastRules,
      hooks: daredevilSchedulerHooks
    }
  },
  presentation: daredevilUi
});
