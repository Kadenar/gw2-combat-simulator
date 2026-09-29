import { createPublicStateProjector } from '#gw2/platform/engine/profession/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { luminaryHooks } from '#gw2/professions/guardian/specializations/luminary/hooks.js';
import { luminaryModifiers } from '#gw2/professions/guardian/specializations/luminary/modifiers.js';
import { bindLuminaryUi } from '#gw2/professions/guardian/specializations/luminary/presentation.js';
import { LUMINARY_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import {
  LUMINARY_EXTRA_SKILLS,
  LUMINARY_SKILL_MECHANICS
} from '#gw2/professions/guardian/specializations/luminary/skills/index.js';
import {
  LUMINARY_PUBLIC_STATE_PROJECTION,
  luminaryState
} from '#gw2/professions/guardian/specializations/luminary/state.js';
import { luminaryTraits } from '#gw2/professions/guardian/specializations/luminary/traits/index.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const luminaryModule = defineNativeModule({
  id: 'Luminary',
  data: createGuardianModuleData('Luminary', {
    skillMechanics: LUMINARY_SKILL_MECHANICS,
    extraSkills: LUMINARY_EXTRA_SKILLS,
    balanceProfiles: LUMINARY_BALANCE_PROFILES
  }),
  state: { create: luminaryState.create, project: createPublicStateProjector(LUMINARY_PUBLIC_STATE_PROJECTION) },
  modifiers: luminaryModifiers,
  traitDefinitions: luminaryTraits,
  hooks: luminaryHooks,
  presentation: bindLuminaryUi
});
