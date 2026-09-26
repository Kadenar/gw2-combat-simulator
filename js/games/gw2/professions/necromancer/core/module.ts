import { necromancerLiveMechanics } from '#gw2/professions/necromancer/core/live.js';

import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { necromancerCoreAttributeRules } from '#gw2/professions/necromancer/core/traits/modifiers.js';

import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { projectNecromancerPlanningState } from '#gw2/professions/necromancer/family-state.js';
import { bindNecromancerCoreUi } from '#gw2/professions/necromancer/core/presentation.js';
import {
  NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  NECROMANCER_CORE_EXTRA_SKILLS
} from '#gw2/professions/necromancer/core/skills/index.js';

import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILES } from '#gw2/professions/necromancer/core/profiles.js';

export const necromancerCoreModule = defineNativeModule({
  id: 'Core',
  data: createNecromancerModuleData('Core', {
    skillMechanics: NECROMANCER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: NECROMANCER_CORE_EXTRA_SKILLS,
    balanceProfiles: NECROMANCER_CORE_BALANCE_PROFILES,
    autoattackChains: {
      // The API does not link Echo to the omitted final step, so declare the complete in-game sequence explicitly.
      additional: [[ID.ENERVATION_BLADE, ID.ENERVATION_ECHO, ID.DEATHLY_ENERVATION]]
    }
  }),
  state: {
    create: createNecromancerCoreState,
    project: projectNecromancerPlanningState
  },
  mechanics: {
    live: necromancerLiveMechanics,
    modifiers: necromancerCoreAttributeRules
  },
  presentation: bindNecromancerCoreUi
});
