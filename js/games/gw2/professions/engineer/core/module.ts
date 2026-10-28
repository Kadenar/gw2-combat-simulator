import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  ENGINEER_CORE_PROFILE_FIELDS,
  ENGINEER_CORE_SKILL_FIELDS
} from '#gw2/professions/engineer/core/catalog-fields.js';
import { engineerCoreHooks } from '#gw2/professions/engineer/core/hooks.js';
import { bindEngineerCoreUi } from '#gw2/professions/engineer/core/presentation.js';
import {
  ENGINEER_CORE_EXTRA_SKILLS,
  ENGINEER_CORE_SKILL_MECHANICS
} from '#gw2/professions/engineer/core/skills/index.js';
import { createEngineerCoreState, projectEngineerCorePlanningState } from '#gw2/professions/engineer/core/state.js';
import { engineerCoreTraits } from '#gw2/professions/engineer/core/traits/index.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';

export const engineerCoreModule = defineNativeModule({
  canSwapWeaponSetsInCombat: false,
  id: 'Core',
  traitDefinitions: engineerCoreTraits,
  data: createEngineerModuleData('Core', {
    profileFields: ENGINEER_CORE_PROFILE_FIELDS,
    skillFields: ENGINEER_CORE_SKILL_FIELDS,
    skillMechanics: ENGINEER_CORE_SKILL_MECHANICS,
    extraSkills: ENGINEER_CORE_EXTRA_SKILLS,
    // RIFLE_BURST_GRENADE is a sub-packet of Rifle Burst, not a standalone chain member
    autoattackChains: { excludeSkillIds: [ID.RIFLE_BURST_GRENADE] }
  }),
  state: {
    // One runtime owns the mutable Core state.
    create: createEngineerCoreState,
    project: projectEngineerCorePlanningState
  },
  hooks: engineerCoreHooks,
  presentation: bindEngineerCoreUi
});
