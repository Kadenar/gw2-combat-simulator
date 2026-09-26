import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { amalgamAttributeRules } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form-rules.js';
import { amalgamHooks } from '#gw2/professions/engineer/specializations/amalgam/hooks.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/index.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { AMALGAM_BALANCE_PROFILES } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import { bindAmalgamUi } from '#gw2/professions/engineer/specializations/amalgam/presentation.js';

// Compose cast-time protocol state with resolver-side reactions: handlers establish
// strains and Evolve state, while resolved hits drive Rapacious and Carbolic procs.
export const amalgamModule = defineNativeModule({
  id: 'Amalgam',
  data: createEngineerModuleData('Amalgam', {
    skillMechanics: AMALGAM_SKILL_MECHANICS,
    balanceProfiles: AMALGAM_BALANCE_PROFILES
  }),
  state: { create: amalgamState.create },
  modifiers: amalgamAttributeRules,
  hooks: amalgamHooks,
  presentation: bindAmalgamUi
});
