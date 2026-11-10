import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/warrior/data/trait-lines.js';
import {
  BLADESWORN_SKILL_FIELDS,
  WARRIOR_BLADESWORN_PROFILE_FIELDS
} from '#gw2/professions/warrior/specializations/bladesworn/catalog-fields.js';
import { bladeswornHooks } from '#gw2/professions/warrior/specializations/bladesworn/hooks.js';
import { bladeswornUi } from '#gw2/professions/warrior/specializations/bladesworn/presentation.js';
import { WARRIOR_BLADESWORN_AUTOATTACK_CHAINS } from '#gw2/professions/warrior/specializations/bladesworn/skills/autoattack-chains.js';
import { BLADESWORN_SKILLS } from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { WARRIOR_BLADESWORN_SKILL_FLIPS } from '#gw2/professions/warrior/specializations/bladesworn/skills/skill-flips.js';
import {
  bladeswornState,
  projectBladeswornPlanningState
} from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import { warriorBladeswornTraits } from '#gw2/professions/warrior/specializations/bladesworn/traits/index.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const bladeswornModule = defineNativeModule({
  canSwapWeaponSetsInCombat: false,
  id: 'Bladesworn',
  data: createNativeModuleData<WarriorSkill>({
    id: 'Bladesworn',
    traitLines: TRAIT_LINES,
    skillFlips: WARRIOR_BLADESWORN_SKILL_FLIPS,
    profileFields: WARRIOR_BLADESWORN_PROFILE_FIELDS,
    skillFields: BLADESWORN_SKILL_FIELDS,
    skills: BLADESWORN_SKILLS,

    autoattackChains: WARRIOR_BLADESWORN_AUTOATTACK_CHAINS
  }),
  state: {
    create: bladeswornState.create,
    project: projectBladeswornPlanningState
  },
  traitDefinitions: warriorBladeswornTraits,
  hooks: bladeswornHooks,
  presentation: bladeswornUi
});
