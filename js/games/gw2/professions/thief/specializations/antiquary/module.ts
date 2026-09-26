import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { antiquaryModifiers } from '#gw2/professions/thief/specializations/antiquary/modifiers.js';
import { antiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';
import { antiquaryUi } from '#gw2/professions/thief/specializations/antiquary/presentation.js';
import { ANTIQUARY_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/antiquary/skills/index.js';
import { ANTIQUARY_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/antiquary/profiles.js';
import { antiquaryHooks } from '#gw2/professions/thief/specializations/antiquary/hooks.js';

export const antiquaryModule = defineNativeModule({
  id: 'Antiquary',
  data: createThiefModuleData('Antiquary', {
    skillMechanics: ANTIQUARY_SKILL_MECHANICS,
    balanceProfiles: ANTIQUARY_BALANCE_PROFILES
  }),
  state: { create: antiquaryState.create },
  modifiers: antiquaryModifiers,
  hooks: antiquaryHooks,
  presentation: antiquaryUi
});
