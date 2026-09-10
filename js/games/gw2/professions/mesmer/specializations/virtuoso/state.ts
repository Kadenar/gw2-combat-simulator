import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { MesmerVirtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/types.js';

// Infinite Forge timing belongs to recurring scheduler tasks, not specialization state.
export function createVirtuosoState(): MesmerVirtuosoState {
  return {
    numericResource: 0,
    bloodsongProgress: 0
  };
}

export const virtuosoState = defineProfessionSpecializationState('Virtuoso', createVirtuosoState);
