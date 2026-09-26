import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { daredevilModifiers } from '#gw2/professions/thief/specializations/daredevil/modifiers.js';
import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { DAREDEVIL_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/daredevil/skills/index.js';
import { DAREDEVIL_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/daredevil/profiles.js';
import { daredevilUi } from '#gw2/professions/thief/specializations/daredevil/presentation.js';
import { daredevilHooks } from '#gw2/professions/thief/specializations/daredevil/hooks.js';

export const daredevilModule = defineNativeModule({
  id: 'Daredevil',
  data: createThiefModuleData('Daredevil', {
    skillMechanics: DAREDEVIL_SKILL_MECHANICS,
    balanceProfiles: DAREDEVIL_BALANCE_PROFILES
  }),
  state: { create: daredevilState.create },
  modifiers: daredevilModifiers,
  hooks: daredevilHooks,
  presentation: daredevilUi
});
