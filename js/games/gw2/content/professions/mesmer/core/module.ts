import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import { onResolvedBlind, onResolvedControl } from '../../../../integrations/patches/authoring/mechanics.js';
import { createMesmerModuleData } from '../data/catalog.js';
import {
  mesmerCoreAttributeRules,
  mesmerCastRules,
  mesmerCoreSchedulerHooks,
  mesmerCoreSkillMechanicHandlers
} from './mechanics/execution.js';
import { mesmerCoreEventHandlers, mesmerCoreEventReactions } from './mechanics/reactions.js';
import { createMesmerCoreResolverState, createMesmerCoreState } from './state.js';
import { projectMesmerEndState, snapshotMesmerState } from '../state/index.js';
import { mesmerCoreUi } from './presentation.js';
import {
  MESMER_CORE_EXTRA_SKILLS,
  MESMER_CORE_SKILL_MECHANICS,
  MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS
} from './skills/index.js';
import { mesmerCoreSkillHandlers } from './skills/handlers.js';
import { MESMER_CORE_BALANCE_PROFILES } from './profiles.js';
import type { MesmerSchedulerContext } from '../types.js';

export const mesmerCoreModule = defineNativeModule({
  id: 'Core',
  data: createMesmerModuleData('Core', {
    skillMechanics: MESMER_CORE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_CORE_EXTRA_SKILLS,
    balanceProfiles: MESMER_CORE_BALANCE_PROFILES
  }),
  state: {
    scheduler: createMesmerCoreState,
    resolver: createMesmerCoreResolverState,
    project: projectMesmerEndState
  },
  mechanics: {
    modifiers: mesmerCoreAttributeRules,
    execution: {
      skillHandlers: mesmerCoreSkillHandlers,
      castRules: mesmerCastRules,
      skillMechanicHandlers: mesmerCoreSkillMechanicHandlers,
      hooks: {
        ...mesmerCoreSchedulerHooks,
        snapshot: (context: MesmerSchedulerContext) => snapshotMesmerState(context.state.profession)
      }
    },
    resolution: {
      reactions: [
        onResolvedControl({
          id: 'mesmer.core.control',
          handler: mesmerCoreEventReactions.control
        }),
        onResolvedBlind({
          id: 'mesmer.core.blind',
          handler: mesmerCoreEventReactions.blind
        })
      ],
      hooks: {
        eventHandlers: mesmerCoreEventHandlers
      }
    }
  },
  presentation: mesmerCoreUi
});
