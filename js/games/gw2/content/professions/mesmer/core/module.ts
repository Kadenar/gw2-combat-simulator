import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { onResolvedBlind, onResolvedControl } from '#gw2/integrations/patches/authoring/mechanics.js';
import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEventInput } from '#gw2/platform/engine/types.js';
import { createMesmerModuleData } from '#gw2/content/professions/mesmer/catalog/module-data.js';
import {
  advanceMesmerScheduler,
  handleCloneAttackTask,
  handleExpectedProcTask,
  handleResourceGainTask,
  initializeMesmerScheduler,
  observeMesmerEvent
} from '#gw2/content/professions/mesmer/core/mechanics/illusions/execution.js';
import {
  mesmerCoreEventHandlers,
  mesmerCoreEventReactions
} from '#gw2/content/professions/mesmer/core/mechanics/reactions.js';
import { completeMesmerCast, startMesmerCast } from '#gw2/content/professions/mesmer/core/skills/cast-lifecycle.js';
import { mesmerCastRules } from '#gw2/content/professions/mesmer/core/skills/recharge.js';
import {
  handleSignetIllusionsPassiveTask,
  mesmerCoreSignetSkillMechanicHandlers
} from '#gw2/content/professions/mesmer/core/skills/signets.js';
import { handleChaoticInterruptionTask } from '#gw2/content/professions/mesmer/core/traits/index.js';
import { mesmerCoreAttributeRules } from '#gw2/content/professions/mesmer/core/traits/modifiers.js';
import { createMesmerCoreResolverState, createMesmerCoreState } from '#gw2/content/professions/mesmer/core/state.js';
import { projectMesmerEndState, snapshotMesmerState } from '#gw2/content/professions/mesmer/state/index.js';
import { mesmerCoreUi } from '#gw2/content/professions/mesmer/core/presentation.js';
import {
  MESMER_CORE_EXTRA_SKILLS,
  MESMER_CORE_SKILL_MECHANICS,
  MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/content/professions/mesmer/core/skills/index.js';
import { mesmerCoreSkillHandlers } from '#gw2/content/professions/mesmer/core/skills/execution.js';
import { MESMER_CORE_BALANCE_PROFILES } from '#gw2/content/professions/mesmer/core/profiles.js';
import type { MesmerSchedulerContext } from '#gw2/content/professions/mesmer/types.js';

/** Assembles the Core Mesmer scheduler hooks while each behavior remains with its owning concept. */
const mesmerCoreSchedulerHooks = Object.freeze({
  prepareEvent: {
    id: 'mesmer.boon-companion-candidates',
    order: 5,
    // Shared boon preparation snapshots active clones before player-first target selection.
    handler: (context: MesmerSchedulerContext, event: SimulationEventInput) =>
      prepareGw2BuffCompanionCandidates(
        event,
        professionCoreState(context).clones.map((clone) => `mesmer.clone:${clone.id}`)
      )
  },
  initialize: initializeMesmerScheduler,
  advance: advanceMesmerScheduler,
  onCastStart: startMesmerCast,
  onCastComplete: completeMesmerCast,
  onEventScheduled: observeMesmerEvent,
  taskHandlers: Object.freeze({
    'mesmer.clone-attack': handleCloneAttackTask,
    'mesmer.resource-gain': handleResourceGainTask,
    'mesmer.expected-proc': handleExpectedProcTask,
    'mesmer.chaotic-interruption': handleChaoticInterruptionTask,
    'mesmer.signet-illusions-passive': handleSignetIllusionsPassiveTask
  })
});

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
      skillMechanicHandlers: mesmerCoreSignetSkillMechanicHandlers,
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
