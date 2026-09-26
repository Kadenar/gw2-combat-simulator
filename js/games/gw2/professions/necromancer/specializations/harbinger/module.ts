import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';

import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';

import { harbingerModifiers } from '#gw2/professions/necromancer/specializations/harbinger/modifiers.js';
import { harbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { harbingerHooks } from '#gw2/professions/necromancer/specializations/harbinger/hooks.js';
import { bindHarbingerUi } from '#gw2/professions/necromancer/specializations/harbinger/presentation.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/index.js';
import { HARBINGER_BALANCE_PROFILES } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';

export const harbingerModule = defineNativeModule({
  id: 'Harbinger',
  data: createNecromancerModuleData('Harbinger', {
    skillMechanics: HARBINGER_BASE_SKILL_MECHANICS,
    balanceProfiles: HARBINGER_BALANCE_PROFILES
  }),
  // One state factory supplies the live combat owner.
  state: { create: harbingerState.create },
  hooks: harbingerHooks,
  modifiers: harbingerModifiers,
  presentation: bindHarbingerUi
});
