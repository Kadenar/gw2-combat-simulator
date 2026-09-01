import type { MesmerConfig } from '#gw2/content/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { MesmerTroubadourState } from '#gw2/content/professions/mesmer/specializations/troubadour/types.js';

export function createTroubadourState(_config: Partial<MesmerConfig> = {}): MesmerTroubadourState {
  return {
    numericResource: 0,
    instruments: {},
    lastInstrument: ''
  };
}

export const troubadourState = defineProfessionSpecializationState('Troubadour', createTroubadourState);
