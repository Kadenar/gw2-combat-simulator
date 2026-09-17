import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { createEvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { evokerUi } from '#gw2/professions/elementalist/specializations/evoker/presentation.js';
import { EVOKER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/index.js';
import { EVOKER_BALANCE_PROFILES } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { evokerCastRules } from '#gw2/professions/elementalist/specializations/evoker/mechanics/availability.js';
import { evokerSchedulerHooks } from '#gw2/professions/elementalist/specializations/evoker/execution/hooks.js';
import { evokerAttributeRules } from '#gw2/professions/elementalist/specializations/evoker/traits/modifiers.js';
import { evokerSkillHandlers } from '#gw2/professions/elementalist/specializations/evoker/execution/index.js';

/**
 * The Evoker elite specialization module: catalog contributions (skill
 * mechanics + balance profiles), scheduler/resolver state factories, execution
 * mechanics, and the build-editor UI contract.
 */
export const evokerModule = defineNativeModule({
  id: 'Evoker',
  data: createElementalistModuleData('Evoker', {
    skillMechanics: EVOKER_SKILL_MECHANICS,
    balanceProfiles: EVOKER_BALANCE_PROFILES
  }),
  state: { scheduler: createEvokerState, resolver: createEvokerState },
  mechanics: {
    modifiers: evokerAttributeRules,
    execution: {
      skillHandlers: evokerSkillHandlers,
      castRules: evokerCastRules,
      hooks: evokerSchedulerHooks
    }
  },
  presentation: evokerUi
});
