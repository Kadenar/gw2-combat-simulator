import type { MesmerConfig } from '#gw2/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export interface MesmerTroubadourState {
  numericResource: number;
  instruments: Record<string, number>;
  lastInstrument: string;
}

export function createTroubadourState(_config: Partial<MesmerConfig> = {}): MesmerTroubadourState {
  return {
    numericResource: 0,
    instruments: {},
    lastInstrument: ''
  };
}

export const troubadourState = defineProfessionSpecializationState('Troubadour', createTroubadourState);
