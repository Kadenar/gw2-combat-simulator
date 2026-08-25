import { defineNativeModule } from '../../../../platform/gw2/authoring/profession.js';
import { onBuffApplied, onResolvedDamage, skillAvailability } from '../../../../platform/gw2/authoring/mechanics.js';
import { createGuardianModuleData } from '../../catalog-data.js';
import { firebrandSkillHandlers } from './handlers.js';
import { firebrandEventHandlers, firebrandEventReactions } from './resolver.js';
import { firebrandAttributeRules, firebrandCastRules, firebrandSchedulerHooks } from './rules.js';
import { FIREBRAND_SKILL_MECHANICS } from './skills.js';
import { firebrandState } from './state.js';
import { firebrandUi } from './ui.js';
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
    castRules: { validateCast: firebrandCastRules.validateCast },
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
