import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { untamedHooks } from '#gw2/professions/ranger/specializations/untamed/hooks.js';
import { bindUntamedUi } from '#gw2/professions/ranger/specializations/untamed/presentation.js';
import { UNTAMED_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { UNTAMED_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/untamed/skills/index.js';
import { projectUntamedPlanningState, untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { untamedTraits } from '#gw2/professions/ranger/specializations/untamed/traits/index.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const untamedModule = defineNativeModule({
  id: 'Untamed',
  traitDefinitions: untamedTraits,
  data: createRangerModuleData('Untamed', {
    skillMechanics: UNTAMED_BASE_SKILL_MECHANICS,
    balanceProfiles: UNTAMED_BALANCE_PROFILES
  }),
  state: { create: untamedState.create, project: projectUntamedPlanningState },
  hooks: untamedHooks,
  presentation: bindUntamedUi
});
