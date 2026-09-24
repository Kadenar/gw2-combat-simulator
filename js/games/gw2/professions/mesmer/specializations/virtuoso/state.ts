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
