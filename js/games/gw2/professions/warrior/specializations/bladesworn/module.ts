import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import {
  BLADESWORN_SHARP_AS_THE_WIND_SKILLS,
  BLADESWORN_SKILL_MECHANICS
} from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import { bladeswornModifiers } from '#gw2/professions/warrior/specializations/bladesworn/modifiers.js';
import { bladeswornHooks } from '#gw2/professions/warrior/specializations/bladesworn/hooks.js';
import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';
import { bladeswornUi } from '#gw2/professions/warrior/specializations/bladesworn/presentation.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { BLADESWORN_BALANCE_PROFILES } from '#gw2/professions/warrior/specializations/bladesworn/profiles.js';

export const bladeswornModule = defineNativeModule({
  id: 'Bladesworn',
  data: createWarriorModuleData('Bladesworn', {
    skillMechanics: BLADESWORN_SKILL_MECHANICS,
    extraSkills: BLADESWORN_SHARP_AS_THE_WIND_SKILLS,
    balanceProfiles: BLADESWORN_BALANCE_PROFILES,
    autoattackChains: {
      additional: [
        [ID.SWIFT_CUT, ID.STEEL_DIVIDE, ID.EXPLOSIVE_THRUST],
        [ID.SHARP_SWIFT_CUT, ID.SHARP_STEEL_DIVIDE, ID.SHARP_EXPLOSIVE_THRUST]
      ]
    }
  }),
  state: {
    create: bladeswornState.create
  },
  modifiers: bladeswornModifiers,
  hooks: bladeswornHooks,
  presentation: bladeswornUi
});
