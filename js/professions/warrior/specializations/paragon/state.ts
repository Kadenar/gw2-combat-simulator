import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';
import type { ParagonState } from '../../types.js';

export function createParagonState(): ParagonState {
  return {
    motivation: 0,
    maximumMotivation: 10,
    activeRefrain: '',
    nextRefrainAt: 0,
    inspiringImplementsReadyAt: 0,
    callToActionActivated: false,
    // Monotonic counter used to generate unique IDs for pending command echoes
    // so individual echoes can be located and removed by identity, not position.
    commandEchoSequence: 0,
    pendingCommandEchoes: []
  };
}

export const paragonState = defineProfessionSpecializationState('Paragon', createParagonState);
