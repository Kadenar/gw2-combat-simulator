import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { catalystHooks } from '#gw2/professions/elementalist/specializations/catalyst/hooks.js';

import { catalystUi } from '#gw2/professions/elementalist/specializations/catalyst/presentation.js';
import { CATALYST_BALANCE_PROFILES } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';
import {
  CATALYST_SKILL_MECHANICS,
  relentlessFireModifiers
} from '#gw2/professions/elementalist/specializations/catalyst/skills/index.js';
import {
  CATALYST_PUBLIC_STATE_PROJECTION,
  catalystState
} from '#gw2/professions/elementalist/specializations/catalyst/state.js';

/**
 * Assembles the Catalyst specialization module: Jade Sphere skill data and balance
 * profiles, the live Catalyst state, the energy and
 * Elemental Empowerment mechanics, and the accepted-event reactions that turn auras,
 * combo finishers, control effects and buff applications into Catalyst trait procs.
 */
export const catalystModule = defineNativeModule({
  id: 'Catalyst',
  traitDefinitions: catalystTraits,
  data: createElementalistModuleData('Catalyst', {
    skillMechanics: CATALYST_SKILL_MECHANICS,
    balanceProfiles: CATALYST_BALANCE_PROFILES
  }),
  state: { create: catalystState.create, project: createPublicStateProjector(CATALYST_PUBLIC_STATE_PROJECTION) },
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: relentlessFireModifiers,
  hooks: catalystHooks,
  presentation: catalystUi
});

import { catalystTraits } from '#gw2/professions/elementalist/specializations/catalyst/traits/index.js';
