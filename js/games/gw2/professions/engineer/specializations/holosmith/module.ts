import { holosmithTraits } from '#gw2/professions/engineer/specializations/holosmith/traits/index.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { holosmithHooks } from '#gw2/professions/engineer/specializations/holosmith/hooks.js';
import { holosmithModifiers } from '#gw2/professions/engineer/specializations/holosmith/modifiers.js';
import { bindHolosmithUi } from '#gw2/professions/engineer/specializations/holosmith/presentation.js';
import { HOLOSMITH_BALANCE_PROFILES } from '#gw2/professions/engineer/specializations/holosmith/profiles.js';
import {
  HOLOSMITH_AUTOATTACK_CHAINS,
  HOLOSMITH_SKILL_MECHANICS
} from '#gw2/professions/engineer/specializations/holosmith/skills/index.js';
import {
  HOLOSMITH_PUBLIC_STATE_PROJECTION,
  holosmithState
} from '#gw2/professions/engineer/specializations/holosmith/state.js';

export const holosmithModule = defineNativeModule({
  id: 'Holosmith',
  traitDefinitions: holosmithTraits,
  data: createEngineerModuleData('Holosmith', {
    skillMechanics: HOLOSMITH_SKILL_MECHANICS,
    balanceProfiles: HOLOSMITH_BALANCE_PROFILES,
    // Runtime name lookup must select the heat-aware identities over Core's non-Holosmith variants.
    skillNameOverrides: {
      'Radiant Arc': ID.RADIANT_ARC,
      'Sun Edge': ID.SUN_EDGE,
      'Sun Ripper': ID.SUN_RIPPER,
      'Gleam Saber': ID.GLEAM_SABER,
      'Refraction Cutter': ID.REFRACTION_CUTTER
    },
    autoattackChains: { additional: HOLOSMITH_AUTOATTACK_CHAINS }
  }),
  // Heat tasks and impact formulas read the same live specialization state.
  state: { create: holosmithState.create, project: createPublicStateProjector(HOLOSMITH_PUBLIC_STATE_PROJECTION) },
  modifiers: holosmithModifiers,
  hooks: holosmithHooks,
  presentation: bindHolosmithUi
});
