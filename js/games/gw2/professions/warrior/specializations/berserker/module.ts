import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { BERSERKER_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/berserker/skills/index.js';
import { berserkerModifiers } from '#gw2/professions/warrior/specializations/berserker/modifiers.js';
import { berserkerHooks } from '#gw2/professions/warrior/specializations/berserker/hooks.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import { berserkerUi } from '#gw2/professions/warrior/specializations/berserker/presentation.js';
import { BERSERKER_BALANCE_PROFILES } from '#gw2/professions/warrior/specializations/berserker/profiles.js';

export const berserkerModule = defineNativeModule({
  id: 'Berserker',
  data: createWarriorModuleData('Berserker', {
    skillMechanics: BERSERKER_SKILL_MECHANICS,
    balanceProfiles: BERSERKER_BALANCE_PROFILES
  }),
  state: { create: berserkerState.create },
  modifiers: berserkerModifiers,
  hooks: berserkerHooks,
  presentation: berserkerUi
});
