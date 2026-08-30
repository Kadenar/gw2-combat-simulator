import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedControl, onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createGuardianModuleData } from '../../data/catalog.js';
import { dragonhunterSkillHandlers } from './skills/handlers.js';
import { dragonhunterEventHandlers, dragonhunterEventReactions } from './mechanics/virtue-effects.js';
import {
  dragonhunterAttributeRules,
  dragonhunterSchedulerHooks,
  dragonhunterSkillMechanicHandlers
} from './mechanics/virtues-and-traps.js';
import { DRAGONHUNTER_SKILL_MECHANICS } from './skills/index.js';
import { dragonhunterState } from './state.js';
import { dragonhunterUi } from './presentation.js';
import { DRAGONHUNTER_BALANCE_PROFILES } from './profiles.js';

export const dragonhunterModule = defineNativeModule({
  id: 'Dragonhunter',
  data: createGuardianModuleData('Dragonhunter', {
    skillMechanics: DRAGONHUNTER_SKILL_MECHANICS,
    balanceProfiles: DRAGONHUNTER_BALANCE_PROFILES
  }),
  state: {
    // Same factory for both phases: scheduler writes tetherUntil during cast,
    // resolver re-derives it from emitted events, so they must start identical.
    scheduler: dragonhunterState.create,
    resolver: dragonhunterState.create
  },
  mechanics: {
    modifiers: dragonhunterAttributeRules,
    execution: {
      skillHandlers: dragonhunterSkillHandlers,
      skillMechanicHandlers: dragonhunterSkillMechanicHandlers,
      hooks: dragonhunterSchedulerHooks
    },
    resolution: {
      reactions: [
        // onResolvedDamage/onResolvedControl wrap the handlers so they fire on
        // "damage.resolved" / control events in resolver order, not as raw event handlers
        ...dragonhunterEventReactions.damage.map(onResolvedDamage),
        ...dragonhunterEventReactions.control.map(onResolvedControl)
      ],
      hooks: { eventHandlers: dragonhunterEventHandlers }
    }
  },
  presentation: dragonhunterUi
});
