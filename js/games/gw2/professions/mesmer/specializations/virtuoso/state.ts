import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import {
  flattenProfessionState,
  projectPublicProfessionState,
  defineProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { createPeriodicTaskState, type PeriodicTaskState } from '#gw2/platform/simulation/periodic-task.js';

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

/** Detach the public blade clock without copying the family's private mechanic state. */
export function projectVirtuosoPlanningState(input: Gw2PlanningStateInput) {
  const state = flattenProfessionState(input.profession) as unknown as MesmerVirtuosoState;
  return projectPublicProfessionState(state, ['blades']);
}
