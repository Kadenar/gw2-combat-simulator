import { prepareGw2BuffCompanionCandidates } from '#gw2/platform/combat/state/allied-players.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEventInput } from '#gw2/platform/engine/events/events.js';
import {
  advanceMesmerScheduler,
  handleCloneAttackTask,
  handleExpectedProcTask,
  handlePartyBuffTask,
  handleResourceGainTask,
  handleTrackedHitTask,
  initializeMesmerScheduler,
  observeMesmerEvent
} from '#gw2/professions/mesmer/core/execution/scheduler-hooks.js';
import { completeMesmerCast, startMesmerCast } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { handleSignetIllusionsPassiveTask } from '#gw2/professions/mesmer/core/mechanics/signets.js';
import { handleChaoticInterruptionTask } from '#gw2/professions/mesmer/core/traits/index.js';
import type { MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';

/** Assembles the Core Mesmer scheduler hooks while each behavior remains with its owning concept. */
export const mesmerCoreSchedulerHooks = Object.freeze({
  prepareEvent: {
    id: 'mesmer.boon-companion-candidates',
    order: 5,
    // Shared boon preparation snapshots active clones before player-first target selection.
    handler: (context: MesmerSchedulerContext, event: SimulationEventInput) => {
      const prepared = prepareGw2BuffCompanionCandidates(
        event,
        professionCoreState(context).clones.map((clone) => `mesmer.clone:${clone.id}`)
      );
      // Blade identity belongs to the Mesmer skill even when the shared scheduler owns its packets.
      const skill = context.catalog.skillsById.get(prepared.skillId ?? '');
      return prepared.type === 'damage' && skill?.blade ? { ...prepared, blade: true } : prepared;
    }
  },
  initialize: initializeMesmerScheduler,
  advance: advanceMesmerScheduler,
  onCastStart: startMesmerCast,
  onCastComplete: completeMesmerCast,
  onEventScheduled: observeMesmerEvent,
  taskHandlers: Object.freeze({
    'mesmer.clone-attack': handleCloneAttackTask,
    'mesmer.party-buff': handlePartyBuffTask,
    'mesmer.resource-gain': handleResourceGainTask,
    'mesmer.expected-proc': handleExpectedProcTask,
    'mesmer.tracked-hit': handleTrackedHitTask,
    'mesmer.chaotic-interruption': handleChaoticInterruptionTask,
    'mesmer.signet-illusions-passive': handleSignetIllusionsPassiveTask
  })
});
