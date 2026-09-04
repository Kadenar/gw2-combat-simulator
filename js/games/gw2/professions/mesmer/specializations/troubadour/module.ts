import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/engine/resolution/handler-registry.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/catalog/module-data.js';
import {
  troubadourAttributeRules,
  troubadourCastRules,
  troubadourSchedulerHooks,
  troubadourSkillMechanicHandlers
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.js';
import { troubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { troubadourUi } from '#gw2/professions/mesmer/specializations/troubadour/presentation.js';
import {
  MESMER_TROUBADOUR_EXTRA_SKILLS,
  MESMER_TROUBADOUR_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import { TROUBADOUR_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import { scheduleTroubadourPerformance } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import type { MesmerHandlerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Performance handlers replace fixed profiles with packets registered at cast start.
const troubadourPerformanceProfile = replaceSkill<MesmerHandlerContext>({
  beforeEffects: (context, skill) => scheduleTroubadourPerformance(context, skill as MesmerSkill)
});

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
        'mesmer.instrument': troubadourPerformanceProfile,
        'mesmer.crescendo': troubadourPerformanceProfile
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
