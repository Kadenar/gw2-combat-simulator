import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onResolvedDamage } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createEngineerModuleData } from '#gw2/content/professions/engineer/catalog/module-data.js';
import { amalgamSkillHandlers } from '#gw2/content/professions/engineer/specializations/amalgam/skills/execution.js';
import { amalgamResolverEventReactions } from '#gw2/content/professions/engineer/specializations/amalgam/mechanics/evolved-form-effects.js';
import {
  amalgamAttributeRules,
  amalgamCastRules,
  amalgamSchedulerHooks
} from '#gw2/content/professions/engineer/specializations/amalgam/mechanics/evolved-form-rules.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/content/professions/engineer/specializations/amalgam/skills/index.js';
import { amalgamState } from '#gw2/content/professions/engineer/specializations/amalgam/state.js';
import { AMALGAM_BALANCE_PROFILES } from '#gw2/content/professions/engineer/specializations/amalgam/profiles.js';
import { bindAmalgamUi } from '#gw2/content/professions/engineer/specializations/amalgam/presentation.js';

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
