import { virtuosoLive } from '#gw2/professions/mesmer/specializations/virtuoso/live.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { virtuosoAttributeRules } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/blades-and-bladesongs.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import { virtuosoUi } from '#gw2/professions/mesmer/specializations/virtuoso/presentation.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import { VIRTUOSO_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';

export const virtuosoModule = defineNativeModule({
  id: 'Virtuoso',
  data: createMesmerModuleData('Virtuoso', {
    skillMechanics: MESMER_VIRTUOSO_SKILL_MECHANICS,
    balanceProfiles: VIRTUOSO_BALANCE_PROFILES
  }),
  state: {
    create: virtuosoState.create
  },
  mechanics: {
    modifiers: virtuosoAttributeRules,
    live: virtuosoLive
  },
  presentation: virtuosoUi
});
