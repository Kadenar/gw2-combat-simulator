import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';

import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';

import { ritualistModifiers } from '#gw2/professions/necromancer/specializations/ritualist/modifiers.js';
import { ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { bindRitualistUi } from '#gw2/professions/necromancer/specializations/ritualist/presentation.js';
import { RITUALIST_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/ritualist/skills/index.js';
import { RITUALIST_BALANCE_PROFILES } from '#gw2/professions/necromancer/specializations/ritualist/profiles.js';
import { ritualistHooks } from '#gw2/professions/necromancer/specializations/ritualist/hooks.js';

export const ritualistModule = defineNativeModule({
  id: 'Ritualist',
  data: createNecromancerModuleData('Ritualist', {
    skillMechanics: RITUALIST_BASE_SKILL_MECHANICS,
    balanceProfiles: RITUALIST_BALANCE_PROFILES
  }),
  // One state factory supplies the live combat owner.
  state: { create: ritualistState.create },
  hooks: ritualistHooks,
  modifiers: ritualistModifiers,
  presentation: bindRitualistUi
});
