import { AMALGAM_SKILL_FIELDS } from '#gw2/professions/engineer/specializations/amalgam/skill-fields.js';
import { amalgamAttributes } from '#gw2/professions/engineer/specializations/amalgam/attributes.js';
import { plasmaticStateModifiers } from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { amalgamHooks } from '#gw2/professions/engineer/specializations/amalgam/hooks.js';

import { bindAmalgamUi } from '#gw2/professions/engineer/specializations/amalgam/presentation.js';
import { AMALGAM_BALANCE_PROFILES } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/index.js';
import {
  AMALGAM_PUBLIC_STATE_PROJECTION,
  amalgamState
} from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { amalgamTraits } from '#gw2/professions/engineer/specializations/amalgam/traits/index.js';

// Compose cast-time protocol state with resolver-side reactions: handlers establish
// strains and Evolve state, while resolved hits drive Rapacious and Carbolic procs.
export const amalgamModule = defineNativeModule({
  id: 'Amalgam',
  traitDefinitions: amalgamTraits,
  data: createEngineerModuleData('Amalgam', {
    skillFields: AMALGAM_SKILL_FIELDS,
    skillMechanics: AMALGAM_SKILL_MECHANICS,
    balanceProfiles: AMALGAM_BALANCE_PROFILES
  }),
  state: { create: amalgamState.create, project: createPublicStateProjector(AMALGAM_PUBLIC_STATE_PROJECTION) },
  attributes: amalgamAttributes,
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: plasmaticStateModifiers,
  hooks: amalgamHooks,
  presentation: bindAmalgamUi
});
