import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import {
  onBuffApplied,
  onResolvedDamage,
  skillAvailability
} from '../../../../../integrations/patches/authoring/mechanics.js';
import { createGuardianModuleData } from '../../data/catalog.js';
import { firebrandSkillHandlers } from './handlers.js';
import { firebrandEventHandlers, firebrandEventReactions } from './resolver.js';
import { firebrandAttributeRules, firebrandCastRules, firebrandSchedulerHooks } from './rules.js';
import { FIREBRAND_SKILL_MECHANICS } from './skills.js';
import { firebrandState } from './state.js';
import { firebrandUi } from './presentation.js';
import { FIREBRAND_BALANCE_PROFILES } from './profiles.js';

export const firebrandModule = defineNativeModule({
  id: 'Firebrand',
  data: createGuardianModuleData('Firebrand', {
    skillMechanics: FIREBRAND_SKILL_MECHANICS,
    balanceProfiles: FIREBRAND_BALANCE_PROFILES,
    handlers: firebrandSkillHandlers
  }),
  state: {
    // Scheduler and resolver each get their own independent copy of the same
    // factory; the two contexts never share a live state object.
    scheduler: firebrandState.create,
    resolver: firebrandState.create
  },
  mechanics: {
    modifiers: firebrandAttributeRules,
    availability: firebrandCastRules.availability.map(skillAvailability),
    schedulerHooks: firebrandSchedulerHooks,
    reactions: [
      ...firebrandEventReactions.damage.map(onResolvedDamage),
      ...firebrandEventReactions.buff.map(onBuffApplied)
    ],
    resolverHooks: {
      eventHandlers: firebrandEventHandlers
    }
  },
  presentation: firebrandUi
});
