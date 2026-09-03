import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/engine/resolution/handler-registry.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/catalog/module-data.js';
import {
  chronomancerAttributeRules,
  chronomancerCastRules,
  chronomancerRuntimeHooks,
  chronomancerSkillMechanicHandlers
} from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split-rules.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import { chronomancerUi } from '#gw2/professions/mesmer/specializations/chronomancer/presentation.js';
import {
  MESMER_CHRONOMANCER_EXTRA_SKILLS,
  MESMER_CHRONOMANCER_SKILL_MECHANICS,
  MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import { mesmerReplaceProfile } from '#gw2/professions/mesmer/core/execution/index.js';
import { CHRONOMANCER_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/chronomancer/profiles.js';

export const chronomancerModule = defineNativeModule({
  id: 'Chronomancer',
  data: createMesmerModuleData('Chronomancer', {
    skillMechanics: MESMER_CHRONOMANCER_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_CHRONOMANCER_EXTRA_SKILLS,
    balanceProfiles: CHRONOMANCER_BALANCE_PROFILES
  }),
  state: {
    scheduler: chronomancerState.create,
    // Chronomancer has no resolver-local state; timeline events carry its resolver data.
    resolver: () => ({})
  },
  mechanics: {
    modifiers: chronomancerAttributeRules,
    execution: {
      // Continuum transitions replace their declarative profiles with stateful handlers.
      skillHandlers: Object.freeze({
        'mesmer.continuum-shift': mesmerReplaceProfile,
        'mesmer.continuum-split': mesmerReplaceProfile
      }),
      castRules: chronomancerCastRules,
      skillMechanicHandlers: chronomancerSkillMechanicHandlers,
      hooks: chronomancerRuntimeHooks
    },
    resolution: {
      hooks: {
        eventHandlers: { 'mesmer.phantasm-resummoned': OBSERVABLE_EVENT_HANDLER }
      }
    }
  },
  presentation: chronomancerUi
});
