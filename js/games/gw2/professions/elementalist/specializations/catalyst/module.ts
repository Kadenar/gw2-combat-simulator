import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import {
  catalystAttributeRules,
  catalystHooks
} from '#gw2/professions/elementalist/specializations/catalyst/mechanics/jade-sphere-and-empowerment.js';
import { catalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { catalystUi } from '#gw2/professions/elementalist/specializations/catalyst/presentation.js';
import { CATALYST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/catalyst/skills/index.js';
import { CATALYST_BALANCE_PROFILES } from '#gw2/professions/elementalist/specializations/catalyst/profiles.js';

/**
 * Assembles the Catalyst specialization module: Jade Sphere skill data and balance
 * profiles, the live Catalyst state, the energy and
 * Elemental Empowerment mechanics, and the accepted-event reactions that turn auras,
 * combo finishers, control effects and buff applications into Catalyst trait procs.
 */
export const catalystModule = defineNativeModule({
  id: 'Catalyst',
  data: createElementalistModuleData('Catalyst', {
    skillMechanics: CATALYST_SKILL_MECHANICS,
    balanceProfiles: CATALYST_BALANCE_PROFILES
  }),
  state: { create: catalystState.create },
  modifiers: catalystAttributeRules,
  hooks: catalystHooks,
  presentation: catalystUi
});
