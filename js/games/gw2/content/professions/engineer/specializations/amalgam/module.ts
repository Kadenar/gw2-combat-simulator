import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createEngineerModuleData } from '../../data/catalog.js';
import { amalgamSkillHandlers } from './skills/handlers.js';
import { amalgamResolverEventReactions } from './mechanics/evolved-form-effects.js';
import { amalgamAttributeRules, amalgamCastRules, amalgamSchedulerHooks } from './mechanics/evolved-form-rules.js';
import { AMALGAM_SKILL_MECHANICS } from './skills/index.js';
import { amalgamState } from './state.js';
import { AMALGAM_BALANCE_PROFILES } from './profiles.js';
import { bindAmalgamUi } from './presentation.js';

// Compose cast-time protocol state with resolver-side reactions: handlers establish
// strains and Evolve state, while resolved hits drive Rapacious and Carbolic procs.
export const amalgamModule = defineNativeModule({
  id: 'Amalgam',
  data: createEngineerModuleData('Amalgam', {
    skillMechanics: AMALGAM_SKILL_MECHANICS,
    balanceProfiles: AMALGAM_BALANCE_PROFILES
  }),
  state: { scheduler: amalgamState.create, resolver: amalgamState.create },
  mechanics: {
    modifiers: amalgamAttributeRules,
    execution: {
      skillHandlers: amalgamSkillHandlers,
      castRules: amalgamCastRules,
      hooks: amalgamSchedulerHooks
    },
    resolution: {
      reactions: [
        onResolvedDamage({
          id: 'engineer.amalgam.damage',
          handler: amalgamResolverEventReactions.damage
        })
      ]
    }
  },
  presentation: bindAmalgamUi
});
