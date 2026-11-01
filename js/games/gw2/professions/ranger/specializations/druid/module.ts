import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/ranger/data/trait-lines.js';
import {
  DRUID_SKILL_FIELDS,
  RANGER_DRUID_PROFILE_FIELDS
} from '#gw2/professions/ranger/specializations/druid/catalog-fields.js';
import { druidHooks } from '#gw2/professions/ranger/specializations/druid/hooks.js';
import { bindDruidUi } from '#gw2/professions/ranger/specializations/druid/presentation.js';
import { DRUID_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/druid/skills/index.js';
import { RANGER_DRUID_SKILL_FLIPS } from '#gw2/professions/ranger/specializations/druid/skills/skill-flips.js';
import { druidState, projectDruidPlanningState } from '#gw2/professions/ranger/specializations/druid/state.js';
import { druidTraits } from '#gw2/professions/ranger/specializations/druid/traits/index.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const druidModule = defineNativeModule({
  id: 'Druid',
  traitDefinitions: druidTraits,
  data: createNativeModuleData<RangerSkill>({
    id: 'Druid',
    traitLines: TRAIT_LINES,
    skillFlips: RANGER_DRUID_SKILL_FLIPS,
    profileFields: RANGER_DRUID_PROFILE_FIELDS,
    skillFields: DRUID_SKILL_FIELDS,
    skillMechanics: DRUID_BASE_SKILL_MECHANICS
  }),
  state: { create: druidState.create, project: projectDruidPlanningState },
  hooks: druidHooks,
  presentation: bindDruidUi
});
