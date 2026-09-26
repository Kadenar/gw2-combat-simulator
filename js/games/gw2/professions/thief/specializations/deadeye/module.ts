import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { deadeyeAttributeRules } from '#gw2/professions/thief/specializations/deadeye/mechanics/malice-rules.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { deadeyeUi } from '#gw2/professions/thief/specializations/deadeye/presentation.js';
import { deadeyeHooks } from '#gw2/professions/thief/specializations/deadeye/hooks.js';
import { DEADEYE_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { DEADEYE_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

export const deadeyeModule = defineNativeModule({
  id: 'Deadeye',
  data: createThiefModuleData('Deadeye', {
    skillMechanics: DEADEYE_SKILL_MECHANICS,
    balanceProfiles: DEADEYE_BALANCE_PROFILES
  }),
  state: { create: deadeyeState.create },
  modifiers: deadeyeAttributeRules,
  hooks: deadeyeHooks,
  presentation: deadeyeUi
});
