import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
import { snapshotProfessionState } from '#gw2/platform/engine/profession/state.js';
import { mesmerResourceDefinition } from '#gw2/professions/mesmer/family-state.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export interface MesmerVirtuosoState {
  numericResource: number;
  bloodsongProgress: number;
}

// Infinite Forge timing belongs to recurring scheduler tasks, not specialization state.
function createVirtuosoState(): MesmerVirtuosoState {
  return {
    numericResource: 0,
    bloodsongProgress: 0
  };
}

export const virtuosoState = defineProfessionSpecializationState('Virtuoso', createVirtuosoState);

/** Publishes this module's detached public observations at the planning boundary. */
export function projectVirtuosoPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as MesmerVirtuosoState;
  return {
    resource: state.numericResource,
    resourceDefinition: mesmerResourceDefinition('Virtuoso', { catalog: input.catalog })
  };
}
