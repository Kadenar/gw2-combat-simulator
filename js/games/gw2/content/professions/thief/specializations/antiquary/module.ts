import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createThiefModuleData } from '../../data/catalog.js';
import { antiquarySkillHandlers } from './skills/handlers.js';
import { antiquaryResolverEventReactions } from './mechanics/artifact-effects.js';
import { antiquaryAttributeRules, antiquaryCastRules, antiquarySchedulerHooks } from './mechanics/artifact-rules.js';
import { antiquaryState } from './state.js';
import { antiquaryUi } from './presentation.js';
import { ANTIQUARY_SKILL_MECHANICS } from './skills/index.js';
import { ANTIQUARY_BALANCE_PROFILES } from './profiles.js';

export const antiquaryModule = defineNativeModule({
  id: 'Antiquary',
  data: createThiefModuleData('Antiquary', {
    skillMechanics: ANTIQUARY_SKILL_MECHANICS,
    balanceProfiles: ANTIQUARY_BALANCE_PROFILES
  }),
  state: { scheduler: antiquaryState.create, resolver: antiquaryState.create },
  mechanics: {
    modifiers: antiquaryAttributeRules,
    execution: {
      skillHandlers: antiquarySkillHandlers,
      castRules: antiquaryCastRules,
      hooks: antiquarySchedulerHooks
    },
    resolution: {
      reactions: [
        onResolvedDamage({
          id: 'thief.antiquary.damage',
          handler: antiquaryResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: antiquaryUi
});
