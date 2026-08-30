import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedControl, onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createRangerModuleData } from '../../data/catalog.js';
import { untamedSkillHandlers } from './skills/handlers.js';
import {
  untamedAttributeRules,
  untamedCastRules,
  untamedSchedulerHooks,
  untamedSkillMechanicHandlers
} from './mechanics/unleash.js';
import { reactToUntamedControl, reactToUntamedDamage, untamedEventHandlers } from './mechanics/unleash-effects.js';
import { UNTAMED_BASE_SKILL_MECHANICS } from './skills/index.js';
import { untamedState } from './state.js';
import { bindUntamedUi } from './presentation.js';
import { UNTAMED_BALANCE_PROFILES } from './profiles.js';

export const untamedModule = defineNativeModule({
  id: 'Untamed',
  data: createRangerModuleData('Untamed', {
    skillMechanics: UNTAMED_BASE_SKILL_MECHANICS,
    balanceProfiles: UNTAMED_BALANCE_PROFILES
  }),
  // Scheduler and resolver each maintain independent copies of UntamedState.
  state: { scheduler: untamedState.create, resolver: untamedState.create },
  mechanics: {
    modifiers: untamedAttributeRules,
    execution: {
      skillHandlers: untamedSkillHandlers,
      castRules: untamedCastRules,
      skillMechanicHandlers: untamedSkillMechanicHandlers,
      hooks: untamedSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: untamedEventHandlers },
      reactions: [
        // Damage and control reactions run at order 20 so generic platform reactions (order < 20) fire first.
        onResolvedDamage({
          id: 'ranger.untamed-damage',
          order: 20,
          handler: reactToUntamedDamage
        }),
        onResolvedControl({
          id: 'ranger.untamed-control',
          order: 20,
          handler: reactToUntamedControl
        })
      ]
    }
  },
  presentation: bindUntamedUi
});
