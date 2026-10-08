import { meditationBalanceProfiles } from '#gw2/professions/elementalist/specializations/evoker/skills/meditation-skills.js';
import { evokerResourceProfile } from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { familiarBalanceProfiles } from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { evokerHooks } from '#gw2/professions/elementalist/specializations/evoker/hooks.js';
import { evokerModifiers } from '#gw2/professions/elementalist/specializations/evoker/modifiers.js';
import { evokerUi } from '#gw2/professions/elementalist/specializations/evoker/presentation.js';
import { EVOKER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/index.js';
import {
  EVOKER_PUBLIC_STATE_PROJECTION,
  evokerState
} from '#gw2/professions/elementalist/specializations/evoker/state.js';

/**
 * The Evoker elite specialization module: catalog contributions (skill
 * mechanics + balance profiles), live state factory, execution
 * mechanics, and the build-editor UI contract.
 */
export const evokerModule = defineNativeModule({
  id: 'Evoker',
  traitDefinitions: evokerTraits,
  data: createElementalistModuleData('Evoker', {
    skillMechanics: EVOKER_SKILL_MECHANICS,
    balanceProfiles: [evokerResourceProfile, ...meditationBalanceProfiles, ...familiarBalanceProfiles]
  }),
  state: { create: evokerState.create, project: createPublicStateProjector(EVOKER_PUBLIC_STATE_PROJECTION) },
  modifiers: evokerModifiers,
  hooks: evokerHooks,
  presentation: evokerUi
});

import { evokerTraits } from '#gw2/professions/elementalist/specializations/evoker/traits/index.js';
