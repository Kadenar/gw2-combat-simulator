import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { revenantCoreAttributeRules } from '#gw2/professions/revenant/core/traits/modifiers.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { projectRevenantPlanningState } from '#gw2/professions/revenant/family-state.js';
import { bindRevenantCoreUi } from '#gw2/professions/revenant/core/presentation.js';
import {
  REVENANT_CORE_BASE_SKILL_MECHANICS,
  REVENANT_CORE_EXTRA_SKILLS
} from '#gw2/professions/revenant/core/skills/index.js';
import { REVENANT_CORE_BALANCE_PROFILES } from '#gw2/professions/revenant/core/profiles.js';
import { revenantCoreHooks } from '#gw2/professions/revenant/core/hooks.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const revenantCoreModule = defineNativeModule({
  id: 'Core',
  data: createRevenantModuleData('Core', {
    skillMechanics: REVENANT_CORE_BASE_SKILL_MECHANICS,
    extraSkills: REVENANT_CORE_EXTRA_SKILLS,
    balanceProfiles: REVENANT_CORE_BALANCE_PROFILES
  }),
  state: { create: createRevenantCoreState, project: projectRevenantPlanningState },
  modifiers: revenantCoreAttributeRules,
  hooks: revenantCoreHooks,
  presentation: bindRevenantCoreUi
});
