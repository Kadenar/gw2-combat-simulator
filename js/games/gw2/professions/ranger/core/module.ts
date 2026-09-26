import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { rangerCoreAttributeRules } from '#gw2/professions/ranger/core/traits/modifiers.js';
import { rangerCoreLive } from '#gw2/professions/ranger/core/live.js';
import {
  RANGER_CORE_BASE_SKILL_MECHANICS,
  RANGER_CORE_EXTRA_SKILLS
} from '#gw2/professions/ranger/core/skills/index.js';
import { RANGER_CORE_BALANCE_PROFILES } from '#gw2/professions/ranger/core/profiles.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { projectRangerPlanningState } from '#gw2/professions/ranger/family-state.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const rangerCoreModule = defineNativeModule({
  id: 'Core',
  data: createRangerModuleData('Core', {
    skillMechanics: RANGER_CORE_BASE_SKILL_MECHANICS,
    balanceProfiles: RANGER_CORE_BALANCE_PROFILES,
    extraSkills: RANGER_CORE_EXTRA_SKILLS
  }),
  state: { create: createRangerCoreState, project: projectRangerPlanningState },
  mechanics: { modifiers: rangerCoreAttributeRules, live: rangerCoreLive },
  presentation: bindRangerCoreUi
});
