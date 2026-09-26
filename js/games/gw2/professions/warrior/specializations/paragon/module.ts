import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { PARAGON_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/paragon/skills/index.js';
import { paragonModifiers } from '#gw2/professions/warrior/specializations/paragon/modifiers.js';
import { paragonHooks } from '#gw2/professions/warrior/specializations/paragon/hooks.js';
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
  modifiers: paragonModifiers,
  hooks: paragonHooks,
  presentation: paragonUi
});
