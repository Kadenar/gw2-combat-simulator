import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onResolvedControl, onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/catalog/module-data.js';
import { dragonhunterSkillHandlers } from '#gw2/professions/guardian/specializations/dragonhunter/execution/virtues.js';
import {
  dragonhunterEventHandlers,
  dragonhunterEventReactions
} from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtue-effects.js';
import {
  dragonhunterAttributeRules,
  dragonhunterSchedulerHooks,
  dragonhunterSkillMechanicHandlers
} from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtues-and-traps.js';
import { DRAGONHUNTER_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/dragonhunter/skills/index.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import { dragonhunterUi } from '#gw2/professions/guardian/specializations/dragonhunter/presentation.js';
import { DRAGONHUNTER_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';

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
