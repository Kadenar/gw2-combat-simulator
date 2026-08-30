import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onConditionApplied } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createThiefModuleData } from '../../data/catalog.js';
import { specterSkillHandlers } from './handlers.js';
import { specterAttributeRules, specterCastRules, specterSchedulerHooks } from './rules.js';
import { specterState } from './state.js';
import { specterUi } from './presentation.js';
import { SPECTER_SKILL_MECHANICS } from './skills.js';
import { applyLarcenousTorment } from './resolver.js';
import { SPECTER_BALANCE_PROFILES } from './profiles.js';

export const specterModule = defineNativeModule({
  id: 'Specter',
  data: createThiefModuleData('Specter', {
    skillMechanics: SPECTER_SKILL_MECHANICS,
    balanceProfiles: SPECTER_BALANCE_PROFILES,
    handlers: specterSkillHandlers
  }),
  // Both phases get independent state instances; sharing the factory is fine because create is called twice.
  state: { scheduler: specterState.create, resolver: specterState.create },
  mechanics: {
    modifiers: specterAttributeRules,
    castRules: specterCastRules,
    schedulerHooks: specterSchedulerHooks,
    reactions: [
      onConditionApplied({
        id: 'thief.specter.larcenous-torment',
        handler: applyLarcenousTorment
      })
    ]
  },
  presentation: specterUi
});
