import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import {
  WARRIOR_CORE_SKILL_MECHANICS,
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS,
  WARRIOR_WEAPON_STOW
} from '#gw2/professions/warrior/core/skills/index.js';
import { warriorCoreModifiers } from '#gw2/professions/warrior/core/modifiers.js';
import { warriorCoreHooks } from '#gw2/professions/warrior/core/hooks.js';
import { createWarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import { projectWarriorPlanningState } from '#gw2/professions/warrior/family-state.js';
import { bindWarriorCoreUi } from '#gw2/professions/warrior/core/presentation.js';
import { WARRIOR_CORE_BALANCE_PROFILES } from '#gw2/professions/warrior/core/profiles.js';

export const warriorCoreModule = defineNativeModule({
  id: 'Core',
  data: createWarriorModuleData('Core', {
    skillMechanics: WARRIOR_CORE_SKILL_MECHANICS,
    balanceProfiles: WARRIOR_CORE_BALANCE_PROFILES,
    extraSkills: [WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS, WARRIOR_WEAPON_STOW]
  }),
  state: {
    create: createWarriorCoreState,
    project: projectWarriorPlanningState
  },
  modifiers: warriorCoreModifiers,
  hooks: warriorCoreHooks,
  presentation: bindWarriorCoreUi
});
