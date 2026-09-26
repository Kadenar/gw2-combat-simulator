import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { PARAGON_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/paragon/skills/index.js';
import { paragonAttributeRules } from '#gw2/professions/warrior/specializations/paragon/mechanics/chants-and-motivation.js';
import { paragonLiveMechanics } from '#gw2/professions/warrior/specializations/paragon/live.js';
import { paragonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { paragonUi } from '#gw2/professions/warrior/specializations/paragon/presentation.js';
import { PARAGON_BALANCE_PROFILES } from '#gw2/professions/warrior/specializations/paragon/profiles.js';

export const paragonModule = defineNativeModule({
  id: 'Paragon',
  data: createWarriorModuleData('Paragon', {
    skillMechanics: PARAGON_SKILL_MECHANICS,
    balanceProfiles: PARAGON_BALANCE_PROFILES
  }),
  state: { create: paragonState.create },
  mechanics: {
    modifiers: paragonAttributeRules,
    live: paragonLiveMechanics
  },
  presentation: paragonUi
});
