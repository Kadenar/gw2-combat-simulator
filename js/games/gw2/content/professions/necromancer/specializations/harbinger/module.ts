import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '../../data/catalog.js';
import { harbingerResolverEventReactions } from './mechanics/blight-effects.js';
import { harbingerAttributeRules, harbingerCastRules, harbingerSchedulerHooks } from './mechanics/blight-and-shroud.js';
import { harbingerState } from './state.js';
import { harbingerUi } from './presentation.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from './skills/index.js';
import { harbingerSkillHandlers } from './skills/handlers.js';
import { HARBINGER_BALANCE_PROFILES } from './profiles.js';

export const harbingerModule = defineNativeModule({
  id: 'Harbinger',
  data: createNecromancerModuleData('Harbinger', {
    skillMechanics: HARBINGER_BASE_SKILL_MECHANICS,
    balanceProfiles: HARBINGER_BALANCE_PROFILES
  }),
  // Scheduler and resolver share the same state factory because blight stacks must be readable in both phases.
  state: { scheduler: harbingerState.create, resolver: harbingerState.create },
  mechanics: {
    modifiers: harbingerAttributeRules,
    execution: {
      skillHandlers: harbingerSkillHandlers,
      castRules: harbingerCastRules,
      hooks: harbingerSchedulerHooks
    },
    resolution: {
      reactions: [
        onResolvedDamage({
          id: 'necromancer.harbinger.damage',
          handler: harbingerResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: harbingerUi
});
