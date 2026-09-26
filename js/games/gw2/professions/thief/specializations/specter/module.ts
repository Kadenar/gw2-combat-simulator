import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { specterModifiers } from '#gw2/professions/thief/specializations/specter/modifiers.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import { specterUi } from '#gw2/professions/thief/specializations/specter/presentation.js';
import { SPECTER_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/specter/skills/index.js';
import { SPECTER_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { specterHooks } from '#gw2/professions/thief/specializations/specter/hooks.js';

export const specterModule = defineNativeModule({
  id: 'Specter',
  data: createThiefModuleData('Specter', {
    skillMechanics: SPECTER_SKILL_MECHANICS,
    balanceProfiles: SPECTER_BALANCE_PROFILES
  }),
  state: { create: specterState.create },
  modifiers: specterModifiers,
  hooks: specterHooks,
  presentation: specterUi
});
