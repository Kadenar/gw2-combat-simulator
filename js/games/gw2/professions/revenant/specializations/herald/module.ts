import { REVENANT_HERALD_PROFILE_FIELDS } from '#gw2/professions/revenant/specializations/herald/catalog-fields.js';
import { heraldAttributes } from '#gw2/professions/revenant/specializations/herald/attributes.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { heraldHooks } from '#gw2/professions/revenant/specializations/herald/hooks.js';

import { heraldUi } from '#gw2/professions/revenant/specializations/herald/presentation.js';
import {
  HERALD_BASE_SKILL_MECHANICS,
  burstOfStrengthModifiers
} from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/herald/traits/index.js';
import { HERALD_SKILL_FIELDS } from '#gw2/professions/revenant/specializations/herald/catalog-fields.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const heraldModule = defineNativeModule({
  traitDefinitions,
  id: 'Herald',
  data: createRevenantModuleData('Herald', {
    profileFields: REVENANT_HERALD_PROFILE_FIELDS,
    skillFields: HERALD_SKILL_FIELDS,
    skillMechanics: HERALD_BASE_SKILL_MECHANICS
  }),
  state: { create: heraldState.create },
  attributes: heraldAttributes,
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: burstOfStrengthModifiers,
  hooks: heraldHooks,
  presentation: heraldUi
});
