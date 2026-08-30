import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createWarriorModuleData } from '../../data/catalog.js';
import { BERSERKER_SKILL_MECHANICS } from './skills/index.js';
import { berserkerSkillHandlers } from './skills/handlers.js';
import { berserkerAttributeRules, berserkerCastRules, berserkerSchedulerHooks } from './mechanics/berserk-rules.js';
import { berserkerState } from './state.js';
import { berserkerUi } from './presentation.js';
import { berserkerReactions } from './mechanics/berserk-effects.js';
import { BERSERKER_BALANCE_PROFILES } from './profiles.js';

export const berserkerModule = defineNativeModule({
  id: 'Berserker',
  data: createWarriorModuleData('Berserker', {
    skillMechanics: BERSERKER_SKILL_MECHANICS,
    balanceProfiles: BERSERKER_BALANCE_PROFILES
  }),
  state: { scheduler: berserkerState.create, resolver: berserkerState.create },
  mechanics: {
    modifiers: berserkerAttributeRules,
    execution: {
      skillHandlers: berserkerSkillHandlers,
      castRules: berserkerCastRules,
      hooks: berserkerSchedulerHooks
    },
    resolution: {
      reactions: berserkerReactions
    }
  },
  presentation: berserkerUi
});
