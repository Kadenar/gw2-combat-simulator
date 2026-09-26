import { evokerHooks } from '#gw2/professions/elementalist/specializations/evoker/hooks.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { evokerUi } from '#gw2/professions/elementalist/specializations/evoker/presentation.js';
import { EVOKER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/index.js';
import { EVOKER_BALANCE_PROFILES } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { evokerModifiers } from '#gw2/professions/elementalist/specializations/evoker/modifiers.js';

/**
 * The Evoker elite specialization module: catalog contributions (skill
 * mechanics + balance profiles), live state factory, execution
 * mechanics, and the build-editor UI contract.
 */
export const evokerModule = defineNativeModule({
  id: 'Evoker',
  data: createElementalistModuleData('Evoker', {
    skillMechanics: EVOKER_SKILL_MECHANICS,
    balanceProfiles: EVOKER_BALANCE_PROFILES
  }),
  state: { create: evokerState.create },
  modifiers: evokerModifiers,
  hooks: evokerHooks,
  presentation: evokerUi
});
