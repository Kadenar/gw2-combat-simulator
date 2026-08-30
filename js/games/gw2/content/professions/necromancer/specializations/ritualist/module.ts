import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createNecromancerModuleData } from '../../data/catalog.js';
import { ritualistEventHandlers, ritualistResolverEventReactions } from './mechanics/spirit-effects.js';
import {
  ritualistAttributeRules,
  ritualistCastRules,
  ritualistSchedulerHooks
} from './mechanics/spirits-and-shards.js';
import { ritualistState } from './state.js';
import { ritualistUi } from './presentation.js';
import { RITUALIST_BASE_SKILL_MECHANICS } from './skills/index.js';
import { ritualistSkillHandlers } from './skills/handlers.js';
import { RITUALIST_BALANCE_PROFILES } from './profiles.js';

export const ritualistModule = defineNativeModule({
  id: 'Ritualist',
  data: createNecromancerModuleData('Ritualist', {
    skillMechanics: RITUALIST_BASE_SKILL_MECHANICS,
    balanceProfiles: RITUALIST_BALANCE_PROFILES
  }),
  // Scheduler and resolver each get their own independent state instance; they do not share the same object
  state: { scheduler: ritualistState.create, resolver: ritualistState.create },
  mechanics: {
    modifiers: ritualistAttributeRules,
    execution: {
      skillHandlers: ritualistSkillHandlers,
      castRules: ritualistCastRules,
      hooks: ritualistSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: ritualistEventHandlers },
      reactions: [
        onResolvedDamage({
          id: 'necromancer.ritualist.damage',
          handler: ritualistResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: ritualistUi
});
