import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '../../data/catalog.js';
import {
  chronomancerAttributeRules,
  chronomancerCastRules,
  chronomancerRuntimeHooks,
  chronomancerSkillMechanicHandlers
} from './mechanics/continuum-split-rules.js';
import { createChronomancerResolverState, chronomancerState } from './state.js';
import { chronomancerUi } from './presentation.js';
import {
  MESMER_CHRONOMANCER_EXTRA_SKILLS,
  MESMER_CHRONOMANCER_SKILL_MECHANICS,
  MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS
} from './skills/index.js';
import { chronomancerSkillHandlers } from './skills/handlers.js';
import { chronomancerEventHandlers } from './mechanics/state-events.js';
import { CHRONOMANCER_BALANCE_PROFILES } from './profiles.js';

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
    resolver: createChronomancerResolverState
  },
  mechanics: {
    modifiers: chronomancerAttributeRules,
    execution: {
      skillHandlers: chronomancerSkillHandlers,
      castRules: chronomancerCastRules,
      skillMechanicHandlers: chronomancerSkillMechanicHandlers,
      hooks: chronomancerRuntimeHooks
    },
    resolution: {
      hooks: { eventHandlers: chronomancerEventHandlers }
    }
  },
  presentation: chronomancerUi
});
