import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { luminaryHooks } from '#gw2/professions/guardian/specializations/luminary/hooks.js';
import { luminaryStanceModifiers } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { luminaryWeaponModifiers } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { bindLuminaryUi } from '#gw2/professions/guardian/specializations/luminary/presentation.js';
import { LUMINARY_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/index.js';
import {
  luminaryState,
  projectLuminaryPlanningState
} from '#gw2/professions/guardian/specializations/luminary/state.js';
import { luminaryTraits } from '#gw2/professions/guardian/specializations/luminary/traits/index.js';
import { LUMINARY_SKILL_FIELDS } from '#gw2/professions/guardian/specializations/luminary/catalog-fields.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const luminaryModule = defineNativeModule({
  id: 'Luminary',
  data: createGuardianModuleData('Luminary', {
    skillFields: LUMINARY_SKILL_FIELDS,
    skillMechanics: LUMINARY_SKILL_MECHANICS
  }),
  state: { create: luminaryState.create, project: projectLuminaryPlanningState },
  // Stance rules precede weapon rules when their authored order ties.
  modifiers: [...luminaryStanceModifiers, ...luminaryWeaponModifiers],
  traitDefinitions: luminaryTraits,
  hooks: luminaryHooks,
  presentation: bindLuminaryUi
});
