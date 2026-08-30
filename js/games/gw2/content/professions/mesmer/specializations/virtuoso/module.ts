import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '#gw2/content/professions/mesmer/catalog/module-data.js';
import {
  virtuosoAttributeRules,
  virtuosoCastRules,
  virtuosoRuntimeHooks
} from '#gw2/content/professions/mesmer/specializations/virtuoso/mechanics/blades-and-bladesongs.js';
import {
  createVirtuosoResolverState,
  virtuosoState
} from '#gw2/content/professions/mesmer/specializations/virtuoso/state.js';
import { virtuosoUi } from '#gw2/content/professions/mesmer/specializations/virtuoso/presentation.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/specializations/virtuoso/skills/index.js';
import { virtuosoSkillHandlers } from '#gw2/content/professions/mesmer/specializations/virtuoso/skills/execution.js';
import { VIRTUOSO_BALANCE_PROFILES } from '#gw2/content/professions/mesmer/specializations/virtuoso/profiles.js';

export const virtuosoModule = defineNativeModule({
  id: 'Virtuoso',
  data: createMesmerModuleData('Virtuoso', {
    skillMechanics: MESMER_VIRTUOSO_SKILL_MECHANICS,
    balanceProfiles: VIRTUOSO_BALANCE_PROFILES
  }),
  state: {
    scheduler: virtuosoState.create,
    resolver: createVirtuosoResolverState
  },
  mechanics: {
    modifiers: virtuosoAttributeRules,
    execution: {
      skillHandlers: virtuosoSkillHandlers,
      castRules: virtuosoCastRules,
      hooks: virtuosoRuntimeHooks
    }
  },
  presentation: virtuosoUi
});
