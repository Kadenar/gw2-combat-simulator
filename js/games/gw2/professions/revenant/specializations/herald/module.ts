import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { heraldHooks } from '#gw2/professions/revenant/specializations/herald/hooks.js';
import { heraldAttributes, heraldModifiers } from '#gw2/professions/revenant/specializations/herald/modifiers.js';
import { heraldUi } from '#gw2/professions/revenant/specializations/herald/presentation.js';
import { HERALD_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/herald/traits/index.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const heraldModule = defineNativeModule({
  traitDefinitions,
  id: 'Herald',
  data: createRevenantModuleData('Herald', {
    skillMechanics: HERALD_BASE_SKILL_MECHANICS,
    balanceProfiles: HERALD_BALANCE_PROFILES
  }),
  state: { create: heraldState.create },
  attributes: heraldAttributes,
  modifiers: heraldModifiers,
  hooks: heraldHooks,
  presentation: heraldUi
});
