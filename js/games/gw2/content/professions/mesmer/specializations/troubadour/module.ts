import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '../../data/catalog.js';
import {
  troubadourAttributeRules,
  troubadourCastRules,
  troubadourSchedulerHooks,
  troubadourSkillMechanicHandlers
} from './mechanics/instrument-rules.js';
import { createTroubadourResolverState, troubadourState } from './state.js';
import { troubadourUi } from './presentation.js';
import {
  MESMER_TROUBADOUR_EXTRA_SKILLS,
  MESMER_TROUBADOUR_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS
} from './skills/index.js';
import { troubadourSkillHandlers } from './skills/handlers.js';
import { troubadourEventHandlers } from './mechanics/state-events.js';
import { TROUBADOUR_BALANCE_PROFILES } from './profiles.js';

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
    resolver: createTroubadourResolverState
  },
  mechanics: {
    modifiers: troubadourAttributeRules,
    execution: {
      skillHandlers: troubadourSkillHandlers,
      castRules: troubadourCastRules,
      skillMechanicHandlers: troubadourSkillMechanicHandlers,
      hooks: troubadourSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: troubadourEventHandlers }
    }
  },
  presentation: troubadourUi
});
