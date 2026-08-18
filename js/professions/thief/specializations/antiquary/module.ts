import { defineNativeModule, onResolvedDamage } from '../../../../platform/gw2/native-profession.js';
import { createThiefModuleData } from '../../catalog-data.js';
import { antiquarySkillHandlers } from './handlers.js';
import { antiquaryResolverEventReactions } from './resolver.js';
import { antiquaryAttributeRules, antiquaryCastRules, antiquarySchedulerHooks } from './rules.js';
import { antiquaryState } from './state.js';
import { antiquaryUi } from './ui.js';
import { ANTIQUARY_SKILL_MECHANICS } from './skills.js';
import { ANTIQUARY_BALANCE_PROFILES } from './profiles.js';

export const antiquaryModule = defineNativeModule({
  id: 'Antiquary',
  data: createThiefModuleData('Antiquary', {
    skillMechanics: ANTIQUARY_SKILL_MECHANICS,
    balanceProfiles: ANTIQUARY_BALANCE_PROFILES,
    handlers: antiquarySkillHandlers
  }),
  state: { scheduler: antiquaryState.create, resolver: antiquaryState.create },
  mechanics: {
    modifiers: antiquaryAttributeRules,
    castRules: antiquaryCastRules,
    schedulerHooks: antiquarySchedulerHooks,
    reactions: [
      onResolvedDamage({
        id: 'thief.antiquary.damage',
        handler: antiquaryResolverEventReactions.damage
      })
    ]
  },
  presentation: antiquaryUi
});
