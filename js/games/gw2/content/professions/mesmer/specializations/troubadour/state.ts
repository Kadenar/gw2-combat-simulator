import type { MesmerConfig, MesmerTroubadourState } from '#gw2/content/professions/mesmer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export function createTroubadourState(_config: Partial<MesmerConfig> = {}): MesmerTroubadourState {
  return {
    numericResource: 0,
    instruments: {},
    lastInstrument: ''
  };
}

export function createTroubadourResolverState(): Record<string, never> {
  return {};
}

export const troubadourState = defineProfessionSpecializationState('Troubadour', createTroubadourState);
