import { defineNativeModule } from '../../../../platform/gw2/authoring/profession.js';
import { onResolvedDamage } from '../../../../platform/gw2/authoring/mechanics.js';
import { createEngineerModuleData } from '../../catalog-data.js';
import { amalgamSkillHandlers } from './handlers.js';
import { amalgamResolverEventReactions } from './resolver.js';
import { amalgamAttributeRules, amalgamCastRules, amalgamSchedulerHooks } from './rules.js';
import { AMALGAM_SKILL_MECHANICS } from './skills.js';
import { amalgamState } from './state.js';
import { AMALGAM_BALANCE_PROFILES } from './profiles.js';
import { bindAmalgamUi } from './ui.js';

// Compose cast-time protocol state with resolver-side reactions: handlers establish
// strains and Evolve state, while resolved hits drive Rapacious and Carbolic procs.
export const amalgamModule = defineNativeModule({
  id: 'Amalgam',
  data: createEngineerModuleData('Amalgam', {
    skillMechanics: AMALGAM_SKILL_MECHANICS,
    balanceProfiles: AMALGAM_BALANCE_PROFILES,
    handlers: amalgamSkillHandlers
  }),
  state: { scheduler: amalgamState.create, resolver: amalgamState.create },
  mechanics: {
    modifiers: amalgamAttributeRules,
    castRules: amalgamCastRules,
    schedulerHooks: amalgamSchedulerHooks,
    reactions: [
      onResolvedDamage({
        id: 'engineer.amalgam.damage',
        handler: amalgamResolverEventReactions.damage
      })
    ]
  },
  presentation: bindAmalgamUi
});
