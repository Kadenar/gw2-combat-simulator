import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';

import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';

import { scourgeAttributeRules } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shade-rules.js';
import { scourgeState } from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { scourgeLiveMechanics } from '#gw2/professions/necromancer/specializations/scourge/live.js';
import { bindScourgeUi } from '#gw2/professions/necromancer/specializations/scourge/presentation.js';
import { SCOURGE_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/scourge/skills/index.js';
import { SCOURGE_BALANCE_PROFILES } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';

export const scourgeModule = defineNativeModule({
  id: 'Scourge',
  data: createNecromancerModuleData('Scourge', {
    skillMechanics: SCOURGE_BASE_SKILL_MECHANICS,
    balanceProfiles: SCOURGE_BALANCE_PROFILES
  }),
  state: { create: scourgeState.create },
  mechanics: {
    live: scourgeLiveMechanics,
    modifiers: scourgeAttributeRules
  },
  presentation: bindScourgeUi
});
