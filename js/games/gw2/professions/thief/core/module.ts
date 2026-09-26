import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { thiefCoreAttributeRules } from '#gw2/professions/thief/core/traits/modifiers.js';
import { createThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { projectThiefPlanningState } from '#gw2/professions/thief/family-state.js';
import { thiefCoreUi } from '#gw2/professions/thief/core/presentation.js';
import { THIEF_CORE_EXTRA_SKILLS, THIEF_CORE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/index.js';
import { THIEF_CORE_BALANCE_PROFILES } from '#gw2/professions/thief/core/profiles.js';
import { thiefCoreLiveMechanics } from '#gw2/professions/thief/core/live.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const thiefCoreModule = defineNativeModule({
  id: 'Core',
  data: createThiefModuleData('Core', {
    skillMechanics: THIEF_CORE_SKILL_MECHANICS,
    balanceProfiles: THIEF_CORE_BALANCE_PROFILES,
    extraSkills: THIEF_CORE_EXTRA_SKILLS
  }),
  state: { create: createThiefCoreState, project: projectThiefPlanningState },
  mechanics: { modifiers: thiefCoreAttributeRules, live: thiefCoreLiveMechanics },
  presentation: thiefCoreUi
});
