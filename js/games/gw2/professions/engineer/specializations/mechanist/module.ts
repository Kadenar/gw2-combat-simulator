import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { mechanistAttributeRules } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-rules.js';
import { mechanistLive } from '#gw2/professions/engineer/specializations/mechanist/live.js';
import { MECHANIST_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/index.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { MECHANIST_BALANCE_PROFILES } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import { mechanistUi } from '#gw2/professions/engineer/specializations/mechanist/presentation.js';

// Compose the mech's independent live lane with accepted-hit reactions for
// hit-triggered traits; the engineer's own cast lane remains owned by Core.
export const mechanistModule = defineNativeModule({
  id: 'Mechanist',
  data: createEngineerModuleData('Mechanist', {
    skillMechanics: MECHANIST_SKILL_MECHANICS,
    balanceProfiles: MECHANIST_BALANCE_PROFILES
  }),
  state: { create: mechanistState.create },
  mechanics: {
    modifiers: mechanistAttributeRules,
    live: mechanistLive
  },
  presentation: mechanistUi
});
