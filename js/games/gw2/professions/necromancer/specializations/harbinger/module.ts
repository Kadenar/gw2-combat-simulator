import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { harbingerHooks } from '#gw2/professions/necromancer/specializations/harbinger/hooks.js';
import { bindHarbingerUi } from '#gw2/professions/necromancer/specializations/harbinger/presentation.js';
import { HARBINGER_BALANCE_PROFILES } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/index.js';
import {
  harbingerState,
  projectHarbingerPlanningState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { necromancerHarbingerTraits } from '#gw2/professions/necromancer/specializations/harbinger/traits/index.js';

export const harbingerModule = defineNativeModule({
  traitDefinitions: necromancerHarbingerTraits,
  id: 'Harbinger',
  data: createNecromancerModuleData('Harbinger', {
    skillMechanics: HARBINGER_BASE_SKILL_MECHANICS,
    balanceProfiles: HARBINGER_BALANCE_PROFILES
  }),
  // One state factory supplies the live combat owner.
  state: { create: harbingerState.create, project: projectHarbingerPlanningState },
  hooks: harbingerHooks,
  presentation: bindHarbingerUi
});
