import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '../../catalog-data.js';
import { ritualistEventHandlers, ritualistResolverEventReactions } from './resolver.js';
import { ritualistAttributeRules, ritualistCastRules, ritualistSchedulerHooks } from './rules.js';
import { ritualistState } from './state.js';
import { ritualistUi } from './ui.js';
import { RITUALIST_BASE_SKILL_MECHANICS } from './skills.js';
import { ritualistSkillHandlers } from './handlers.js';
import { RITUALIST_BALANCE_PROFILES } from './profiles.js';

export const ritualistModule = defineNativeModule({
  id: 'Ritualist',
  data: createNecromancerModuleData('Ritualist', {
    skillMechanics: RITUALIST_BASE_SKILL_MECHANICS,
    balanceProfiles: RITUALIST_BALANCE_PROFILES,
    handlers: ritualistSkillHandlers
  }),
  // Scheduler and resolver each get their own independent state instance; they do not share the same object
  state: { scheduler: ritualistState.create, resolver: ritualistState.create },
  mechanics: {
    modifiers: ritualistAttributeRules,
    castRules: ritualistCastRules,
    resolverHooks: { eventHandlers: ritualistEventHandlers },
    reactions: [
      onResolvedDamage({
        id: 'necromancer.ritualist.damage',
        handler: ritualistResolverEventReactions.damage
      })
    ],
    schedulerHooks: ritualistSchedulerHooks
  },
  presentation: ritualistUi
});
