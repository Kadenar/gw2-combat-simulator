import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import { createResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

export interface MesmerVirtuosoState {
  blades: ResourceClock;
  bloodsongProgress: number;
}

// Infinite Forge timing belongs to recurring scheduler tasks, not specialization state.
function createVirtuosoState(): MesmerVirtuosoState {
  return {
    blades: createResourceClock(),
    bloodsongProgress: 0
  };
}

export const virtuosoState = defineProfessionSpecializationState('Virtuoso', createVirtuosoState);

/** Publishes this module's detached public observations at the planning boundary. */
export function projectVirtuosoPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as MesmerVirtuosoState;
  return {
    blades: state.blades
  };
}
