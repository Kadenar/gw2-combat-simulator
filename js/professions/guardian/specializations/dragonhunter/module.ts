import { defineNativeModule } from '../../../../platform/gw2/authoring/profession.js';
import { onResolvedControl, onResolvedDamage } from '../../../../platform/gw2/authoring/mechanics.js';
import { createGuardianModuleData } from '../../catalog-data.js';
import { dragonhunterSkillHandlers } from './handlers.js';
import { dragonhunterEventHandlers, dragonhunterEventReactions } from './resolver.js';
import { dragonhunterAttributeRules, dragonhunterSchedulerHooks, dragonhunterSkillMechanicHandlers } from './rules.js';
import { DRAGONHUNTER_SKILL_MECHANICS } from './skills.js';
import { dragonhunterState } from './state.js';
import { dragonhunterUi } from './ui.js';
import { DRAGONHUNTER_BALANCE_PROFILES } from './profiles.js';

export const dragonhunterModule = defineNativeModule({
  id: 'Dragonhunter',
  data: createGuardianModuleData('Dragonhunter', {
    skillMechanics: DRAGONHUNTER_SKILL_MECHANICS,
    balanceProfiles: DRAGONHUNTER_BALANCE_PROFILES,
    handlers: dragonhunterSkillHandlers
  }),
  state: {
    // Same factory for both phases: scheduler writes tetherUntil during cast,
    // resolver re-derives it from emitted events, so they must start identical.
    scheduler: dragonhunterState.create,
    resolver: dragonhunterState.create
  },
  mechanics: {
    modifiers: dragonhunterAttributeRules,
    skillMechanicHandlers: dragonhunterSkillMechanicHandlers,
    schedulerHooks: dragonhunterSchedulerHooks,
    reactions: [
      // onResolvedDamage/onResolvedControl wrap the handlers so they fire on
      // "damage.resolved" / control events in resolver order, not as raw event handlers
      ...dragonhunterEventReactions.damage.map(onResolvedDamage),
      ...dragonhunterEventReactions.control.map(onResolvedControl)
    ],
    resolverHooks: { eventHandlers: dragonhunterEventHandlers }
  },
  presentation: dragonhunterUi
});
