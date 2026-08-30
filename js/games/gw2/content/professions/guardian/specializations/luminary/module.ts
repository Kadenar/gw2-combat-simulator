import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createGuardianModuleData } from '../../data/catalog.js';
import { luminarySkillHandlers } from './skills/handlers.js';
import { luminaryEventHandlers, luminaryEventReactions } from './mechanics/radiant-forge-effects.js';
import {
  luminaryAttributeRules,
  luminaryCastRules,
  luminarySchedulerHooks,
  luminarySkillMechanicHandlers
} from './mechanics/radiant-forge-rules.js';
import { LUMINARY_SKILL_MECHANICS } from './skills/index.js';
import { luminaryState } from './state.js';
import { luminaryUi } from './presentation.js';
import { LUMINARY_BALANCE_PROFILES } from './profiles.js';

export const luminaryModule = defineNativeModule({
  id: 'Luminary',
  data: createGuardianModuleData('Luminary', {
    skillMechanics: LUMINARY_SKILL_MECHANICS,
    balanceProfiles: LUMINARY_BALANCE_PROFILES
  }),
  state: {
    // Both scheduler and resolver get independent state instances; the resolver
    // rebuilds its view by replaying timeline events rather than sharing a
    // reference with the scheduler.
    scheduler: luminaryState.create,
    resolver: luminaryState.create
  },
  mechanics: {
    modifiers: luminaryAttributeRules,
    execution: {
      skillHandlers: luminarySkillHandlers,
      castRules: luminaryCastRules,
      skillMechanicHandlers: luminarySkillMechanicHandlers,
      hooks: luminarySchedulerHooks
    },
    resolution: {
      // .map(onResolvedDamage) wraps each reaction so it only fires after damage
      // has been numerically resolved rather than at raw event time.
      reactions: luminaryEventReactions.damage.map(onResolvedDamage),
      hooks: { eventHandlers: luminaryEventHandlers }
    }
  },
  presentation: luminaryUi
});
