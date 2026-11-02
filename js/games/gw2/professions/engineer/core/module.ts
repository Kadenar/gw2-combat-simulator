import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  ENGINEER_CORE_PROFILE_FIELDS,
  ENGINEER_CORE_SKILL_FIELDS
} from '#gw2/professions/engineer/core/catalog-fields.js';
import { engineerCoreHooks } from '#gw2/professions/engineer/core/hooks.js';
import { bindEngineerCoreUi } from '#gw2/professions/engineer/core/presentation.js';
import { ENGINEER_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/engineer/core/skills/autoattack-chains.js';
import { ENGINEER_CORE_SKILLS } from '#gw2/professions/engineer/core/skills/index.js';
import { ENGINEER_CORE_SKILL_FLIPS } from '#gw2/professions/engineer/core/skills/skill-flips.js';
import { createEngineerCoreState, projectEngineerCorePlanningState } from '#gw2/professions/engineer/core/state.js';
import { engineerCoreTraits } from '#gw2/professions/engineer/core/traits/index.js';
import { TRAIT_LINES } from '#gw2/professions/engineer/data/trait-lines.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Hammer: '2h',
  Mace: 'mh',
  Pistol: 'mh+oh',
  Rifle: '2h',
  Shield: 'oh',
  Shortbow: '2h',
  Spear: '2h',
  Sword: 'mh'
});

export const engineerCoreModule = defineNativeModule({
  canSwapWeaponSetsInCombat: false,
  id: 'Core',
  traitDefinitions: engineerCoreTraits,
  data: createNativeModuleData<EngineerSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: ENGINEER_CORE_SKILL_FLIPS,
    profileFields: ENGINEER_CORE_PROFILE_FIELDS,
    skillFields: ENGINEER_CORE_SKILL_FIELDS,
    skills: ENGINEER_CORE_SKILLS,

    autoattackChains: ENGINEER_CORE_AUTOATTACK_CHAINS
  }),
  state: {
    // One runtime owns the mutable Core state.
    create: createEngineerCoreState,
    project: projectEngineerCorePlanningState
  },
  hooks: engineerCoreHooks,
  presentation: bindEngineerCoreUi
});
