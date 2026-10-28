import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import {
  DRUID_SKILL_FIELDS,
  RANGER_DRUID_PROFILE_FIELDS
} from '#gw2/professions/ranger/specializations/druid/catalog-fields.js';
import { druidHooks } from '#gw2/professions/ranger/specializations/druid/hooks.js';
import { bindDruidUi } from '#gw2/professions/ranger/specializations/druid/presentation.js';
import { DRUID_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/druid/skills/index.js';
import { druidState, projectDruidPlanningState } from '#gw2/professions/ranger/specializations/druid/state.js';
import { druidTraits } from '#gw2/professions/ranger/specializations/druid/traits/index.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const druidModule = defineNativeModule({
  id: 'Druid',
  traitDefinitions: druidTraits,
  data: createRangerModuleData('Druid', {
    profileFields: RANGER_DRUID_PROFILE_FIELDS,
    skillFields: DRUID_SKILL_FIELDS,
    skillMechanics: DRUID_BASE_SKILL_MECHANICS
  }),
  state: { create: druidState.create, project: projectDruidPlanningState },
  hooks: druidHooks,
  presentation: bindDruidUi
});
