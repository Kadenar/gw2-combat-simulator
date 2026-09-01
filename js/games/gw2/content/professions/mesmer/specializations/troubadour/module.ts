import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/engine/resolution/handler-registry.js';
import { createMesmerModuleData } from '#gw2/content/professions/mesmer/catalog/module-data.js';
import {
  troubadourAttributeRules,
  troubadourCastRules,
  troubadourSchedulerHooks,
  troubadourSkillMechanicHandlers
} from '#gw2/content/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.js';
import { troubadourState } from '#gw2/content/professions/mesmer/specializations/troubadour/state.js';
import { troubadourUi } from '#gw2/content/professions/mesmer/specializations/troubadour/presentation.js';
import {
  MESMER_TROUBADOUR_EXTRA_SKILLS,
  MESMER_TROUBADOUR_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/content/professions/mesmer/specializations/troubadour/skills/index.js';
import { mesmerReplaceProfile } from '#gw2/content/professions/mesmer/core/skills/execution.js';
import { TROUBADOUR_BALANCE_PROFILES } from '#gw2/content/professions/mesmer/specializations/troubadour/profiles.js';

export const troubadourModule = defineNativeModule({
  id: 'Troubadour',
  data: createMesmerModuleData('Troubadour', {
    skillMechanics: MESMER_TROUBADOUR_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_TROUBADOUR_EXTRA_SKILLS,
    balanceProfiles: TROUBADOUR_BALANCE_PROFILES
  }),
  state: {
    scheduler: troubadourState.create,
    // Troubadour has no resolver-local state; timeline events carry its resolver data.
    resolver: () => ({})
  },
  mechanics: {
    modifiers: troubadourAttributeRules,
    execution: {
      // Instrument actions replace their declarative profiles with stateful handlers.
      skillHandlers: Object.freeze({
        'mesmer.instrument': mesmerReplaceProfile,
        'mesmer.crescendo': mesmerReplaceProfile
      }),
      castRules: troubadourCastRules,
      skillMechanicHandlers: troubadourSkillMechanicHandlers,
      hooks: troubadourSchedulerHooks
    },
    resolution: {
      hooks: {
        eventHandlers: { 'mesmer.instrument': OBSERVABLE_EVENT_HANDLER }
      }
    }
  },
  presentation: troubadourUi
});
