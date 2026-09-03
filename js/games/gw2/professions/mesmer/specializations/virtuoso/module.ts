import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/catalog/module-data.js';
import {
  virtuosoAttributeRules,
  virtuosoCastRules,
  virtuosoRuntimeHooks
} from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/blades-and-bladesongs.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import { virtuosoUi } from '#gw2/professions/mesmer/specializations/virtuoso/presentation.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import { mesmerReplaceProfile } from '#gw2/professions/mesmer/core/execution/index.js';
import { VIRTUOSO_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';

export const virtuosoModule = defineNativeModule({
  id: 'Virtuoso',
  data: createMesmerModuleData('Virtuoso', {
    skillMechanics: MESMER_VIRTUOSO_SKILL_MECHANICS,
    balanceProfiles: VIRTUOSO_BALANCE_PROFILES
  }),
  state: {
    scheduler: virtuosoState.create,
    // Virtuoso has no resolver-local state; timeline events carry its resolver data.
    resolver: () => ({})
  },
  mechanics: {
    modifiers: virtuosoAttributeRules,
    execution: {
      // Bladesongs replace their declarative profiles with blade-aware handlers.
      skillHandlers: Object.freeze({ 'mesmer.bladesong': mesmerReplaceProfile }),
      castRules: virtuosoCastRules,
      hooks: virtuosoRuntimeHooks
    }
  },
  presentation: virtuosoUi
});
