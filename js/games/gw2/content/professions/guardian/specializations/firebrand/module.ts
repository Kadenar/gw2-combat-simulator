import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import {
  onBuffApplied,
  onResolvedDamage,
  skillAvailability
} from '../../../../../integrations/patches/authoring/mechanics.js';
import { createGuardianModuleData } from '../../data/catalog.js';
import { firebrandSkillHandlers } from './skills/handlers.js';
import { firebrandEventHandlers, firebrandEventReactions } from './mechanics/tome-effects.js';
import { firebrandAttributeRules, firebrandCastRules, firebrandSchedulerHooks } from './mechanics/tomes-and-mantras.js';
import { FIREBRAND_SKILL_MECHANICS } from './skills/index.js';
import { firebrandState } from './state.js';
import { firebrandUi } from './presentation.js';
import { FIREBRAND_BALANCE_PROFILES } from './profiles.js';

export const firebrandModule = defineNativeModule({
  id: 'Firebrand',
  data: createGuardianModuleData('Firebrand', {
    skillMechanics: FIREBRAND_SKILL_MECHANICS,
    balanceProfiles: FIREBRAND_BALANCE_PROFILES
  }),
  state: {
    // Scheduler and resolver each get their own independent copy of the same
    // factory; the two contexts never share a live state object.
    scheduler: firebrandState.create,
    resolver: firebrandState.create
  },
  mechanics: {
    modifiers: firebrandAttributeRules,
    execution: {
      skillHandlers: firebrandSkillHandlers,
      availability: firebrandCastRules.availability.map(skillAvailability),
      hooks: firebrandSchedulerHooks
    },
    resolution: {
      reactions: [
        ...firebrandEventReactions.damage.map(onResolvedDamage),
        ...firebrandEventReactions.buff.map(onBuffApplied)
      ],
      hooks: {
        eventHandlers: firebrandEventHandlers
      }
    }
  },
  presentation: firebrandUi
});
