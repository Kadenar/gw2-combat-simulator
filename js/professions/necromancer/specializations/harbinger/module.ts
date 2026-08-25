import { defineNativeModule } from '../../../../platform/gw2/authoring/profession.js';
import { onResolvedDamage } from '../../../../platform/gw2/authoring/mechanics.js';
import { createNecromancerModuleData } from '../../catalog-data.js';
import { harbingerResolverEventReactions } from './resolver.js';
import { harbingerAttributeRules, harbingerCastRules, harbingerSchedulerHooks } from './rules.js';
import { harbingerState } from './state.js';
import { harbingerUi } from './ui.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from './skills.js';
import { harbingerSkillHandlers } from './handlers.js';
import { HARBINGER_BALANCE_PROFILES } from './profiles.js';

export const harbingerModule = defineNativeModule({
  id: 'Harbinger',
  data: createNecromancerModuleData('Harbinger', {
    skillMechanics: HARBINGER_BASE_SKILL_MECHANICS,
    balanceProfiles: HARBINGER_BALANCE_PROFILES,
    handlers: harbingerSkillHandlers
  }),
  // Scheduler and resolver share the same state factory because blight stacks must be readable in both phases.
  state: { scheduler: harbingerState.create, resolver: harbingerState.create },
  mechanics: {
    modifiers: harbingerAttributeRules,
    castRules: harbingerCastRules,
    reactions: [
      onResolvedDamage({
        id: 'necromancer.harbinger.damage',
        handler: harbingerResolverEventReactions.damage
      })
    ],
    schedulerHooks: harbingerSchedulerHooks
  },
  presentation: harbingerUi
});
