import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import { onResolvedBlind, onResolvedControl } from '../../../../integrations/patches/authoring/mechanics.js';
import { createMesmerModuleData } from '../data/catalog.js';
import {
  mesmerCoreAttributeRules,
  mesmerCastRules,
  mesmerCoreSchedulerHooks,
  mesmerCoreSkillMechanicHandlers
} from './rules.js';
import { mesmerCoreEventHandlers, mesmerCoreEventReactions } from './resolver.js';
import { createMesmerCoreResolverState, createMesmerCoreState } from './state.js';
import { projectMesmerEndState, snapshotMesmerState } from '../state/index.js';
import { mesmerCoreUi } from './presentation.js';
import {
  MESMER_CORE_EXTRA_SKILLS,
  MESMER_CORE_SKILL_MECHANICS,
  MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS
} from './skills.js';
import { mesmerCoreSkillHandlers } from './handlers.js';
import { MESMER_CORE_BALANCE_PROFILES } from './profiles.js';
import type { MesmerSchedulerContext } from '../types.js';

export const mesmerCoreModule = defineNativeModule({
  id: 'Core',
  data: createMesmerModuleData('Core', {
    skillMechanics: MESMER_CORE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_CORE_EXTRA_SKILLS,
    balanceProfiles: MESMER_CORE_BALANCE_PROFILES,
    handlers: mesmerCoreSkillHandlers
  }),
  state: {
    scheduler: createMesmerCoreState,
    resolver: createMesmerCoreResolverState,
    project: projectMesmerEndState
  },
  mechanics: {
    modifiers: mesmerCoreAttributeRules,
    castRules: mesmerCastRules,
    skillMechanicHandlers: mesmerCoreSkillMechanicHandlers,
    schedulerHooks: {
      ...mesmerCoreSchedulerHooks,
      snapshot: (context: MesmerSchedulerContext) => snapshotMesmerState(context.state.profession)
    },
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
    resolverHooks: {
      eventHandlers: mesmerCoreEventHandlers
    }
  },
  presentation: mesmerCoreUi
});
