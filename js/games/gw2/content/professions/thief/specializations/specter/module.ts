import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onConditionApplied } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createThiefModuleData } from '../../data/catalog.js';
import { specterSkillHandlers } from './skills/handlers.js';
import { specterAttributeRules, specterCastRules, specterSchedulerHooks } from './mechanics/shadow-shroud-rules.js';
import { specterState } from './state.js';
import { specterUi } from './presentation.js';
import { SPECTER_SKILL_MECHANICS } from './skills/index.js';
import { applyLarcenousTorment } from './mechanics/shadow-shroud-effects.js';
import { SPECTER_BALANCE_PROFILES } from './profiles.js';

export const specterModule = defineNativeModule({
  id: 'Specter',
  data: createThiefModuleData('Specter', {
    skillMechanics: SPECTER_SKILL_MECHANICS,
    balanceProfiles: SPECTER_BALANCE_PROFILES
  }),
  // Both phases get independent state instances; sharing the factory is fine because create is called twice.
  state: { scheduler: specterState.create, resolver: specterState.create },
  mechanics: {
    modifiers: specterAttributeRules,
    execution: {
      skillHandlers: specterSkillHandlers,
      castRules: specterCastRules,
      hooks: specterSchedulerHooks
    },
    resolution: {
      reactions: [
        onConditionApplied({
          id: 'thief.specter.larcenous-torment',
          handler: applyLarcenousTorment
        })
      ]
    }
  },
  presentation: specterUi
});
