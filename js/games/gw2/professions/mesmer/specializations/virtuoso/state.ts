import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface MesmerVirtuosoState {
  blades: ResourceClock;
  bloodsongProgress: number;
  infiniteForge: PeriodicTaskState;
}

// Private lifecycle state gives the scheduler one cancellable Infinite Forge occurrence per run.
function createVirtuosoState(): MesmerVirtuosoState {
  return {
    blades: createResourceClock(),
    bloodsongProgress: 0,
    infiniteForge: createPeriodicTaskState()
  };
}

export const virtuosoState = defineProfessionSpecializationState('Virtuoso', createVirtuosoState);

/** Select the public blade clock without reading private mechanic state; the observer detaches the result. */
export function projectVirtuosoPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = virtuosoState.from(input.profession);
  return { [STATE.BLADES]: state.blades };
}
