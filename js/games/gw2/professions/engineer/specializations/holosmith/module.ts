import { ENGINEER_HOLOSMITH_PROFILE_FIELDS } from '#gw2/professions/engineer/specializations/holosmith/catalog-fields.js';
import { holosmithTraits } from '#gw2/professions/engineer/specializations/holosmith/traits/index.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { holosmithHooks } from '#gw2/professions/engineer/specializations/holosmith/hooks.js';
import { holosmithModifiers } from '#gw2/professions/engineer/specializations/holosmith/modifiers.js';
import { bindHolosmithUi } from '#gw2/professions/engineer/specializations/holosmith/presentation.js';
import {
  HOLOSMITH_AUTOATTACK_CHAINS,
  HOLOSMITH_SKILL_MECHANICS
} from '#gw2/professions/engineer/specializations/holosmith/skills/index.js';
import {
  HOLOSMITH_PUBLIC_STATE_PROJECTION,
  holosmithState
} from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { HOLOSMITH_SKILL_FIELDS } from '#gw2/professions/engineer/specializations/holosmith/catalog-fields.js';

export const holosmithModule = defineNativeModule({
  id: 'Holosmith',
  traitDefinitions: holosmithTraits,
  data: createEngineerModuleData('Holosmith', {
    profileFields: ENGINEER_HOLOSMITH_PROFILE_FIELDS,
    skillFields: HOLOSMITH_SKILL_FIELDS,
    skillMechanics: HOLOSMITH_SKILL_MECHANICS,
    autoattackChains: { additional: HOLOSMITH_AUTOATTACK_CHAINS }
  }),
  // Heat tasks and impact formulas read the same live specialization state.
  state: { create: holosmithState.create, project: createPublicStateProjector(HOLOSMITH_PUBLIC_STATE_PROJECTION) },
  modifiers: holosmithModifiers,
  hooks: holosmithHooks,
  presentation: bindHolosmithUi
});
