import { soulbeastAttributes } from '#gw2/professions/ranger/specializations/soulbeast/attributes.js';
import { sicEmPlayerModifiers } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { soulbeastHooks } from '#gw2/professions/ranger/specializations/soulbeast/hooks.js';

import { bindSoulbeastUi } from '#gw2/professions/ranger/specializations/soulbeast/presentation.js';
import { SOULBEAST_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { SOULBEAST_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/index.js';
import {
  SOULBEAST_PUBLIC_STATE_PROJECTION,
  soulbeastState
} from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { soulbeastTraits } from '#gw2/professions/ranger/specializations/soulbeast/traits/index.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const soulbeastModule = defineNativeModule({
  id: 'Soulbeast',
  attributes: soulbeastAttributes,
  traitDefinitions: soulbeastTraits,
  data: createRangerModuleData('Soulbeast', {
    skillMechanics: SOULBEAST_BASE_SKILL_MECHANICS,
    balanceProfiles: SOULBEAST_BALANCE_PROFILES
  }),
  state: { create: soulbeastState.create, project: createPublicStateProjector(SOULBEAST_PUBLIC_STATE_PROJECTION) },
  // The merged command bonus belongs to this elite; Core traits register their own rules.
  modifiers: sicEmPlayerModifiers,
  hooks: soulbeastHooks,
  presentation: bindSoulbeastUi
});
