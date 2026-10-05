import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { warriorCoreHooks } from '#gw2/professions/warrior/core/hooks.js';
import { warriorCoreModifiers } from '#gw2/professions/warrior/core/modifiers.js';
import { warriorCoreUi } from '#gw2/professions/warrior/core/presentation.js';
import { WARRIOR_CORE_BALANCE_PROFILES } from '#gw2/professions/warrior/core/profiles.js';
import {
  WARRIOR_CORE_SKILL_MECHANICS,
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS
} from '#gw2/professions/warrior/core/skills/index.js';
import { createWarriorCoreState, WARRIOR_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/warrior/core/state.js';
import { warriorCoreTraits } from '#gw2/professions/warrior/core/traits/index.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';

export const warriorCoreModule = defineNativeModule({
  id: 'Core',
  data: createWarriorModuleData('Core', {
    skillMechanics: WARRIOR_CORE_SKILL_MECHANICS,
    balanceProfiles: WARRIOR_CORE_BALANCE_PROFILES,
    extraSkills: [WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS]
  }),
  state: {
    create: createWarriorCoreState,
    project: createPublicStateProjector(WARRIOR_CORE_PUBLIC_STATE_PROJECTION)
  },
  traitDefinitions: warriorCoreTraits,
  modifiers: warriorCoreModifiers,
  hooks: warriorCoreHooks,
  // Core presentation is catalog-independent and can be registered directly.
  presentation: warriorCoreUi
});
