import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/ranger/data/trait-lines.js';
import { RANGER_UNTAMED_PROFILE_FIELDS } from '#gw2/professions/ranger/specializations/untamed/catalog-fields.js';
import { untamedHooks } from '#gw2/professions/ranger/specializations/untamed/hooks.js';
import { bindUntamedUi } from '#gw2/professions/ranger/specializations/untamed/presentation.js';
import { UNTAMED_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/untamed/skills/index.js';
import { projectUntamedPlanningState, untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { untamedTraits } from '#gw2/professions/ranger/specializations/untamed/traits/index.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const untamedModule = defineNativeModule({
  id: 'Untamed',
  traitDefinitions: untamedTraits,
  data: createNativeModuleData<RangerSkill>({
    id: 'Untamed',
    traitLines: TRAIT_LINES,
    profileFields: RANGER_UNTAMED_PROFILE_FIELDS,
    skillMechanics: UNTAMED_BASE_SKILL_MECHANICS
  }),
  state: { create: untamedState.create, project: projectUntamedPlanningState },
  hooks: untamedHooks,
  presentation: bindUntamedUi
});
