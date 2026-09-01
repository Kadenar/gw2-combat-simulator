import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { ParagonState } from '#gw2/content/professions/warrior/types.js';

/** Declares Paragon's public compatibility fields and inactive values. */
export const PARAGON_PUBLIC_END_STATE_KEYS = Object.freeze([
  'motivation',
  'maximumMotivation',
  'activeRefrain'
] as const satisfies readonly (keyof ParagonState)[]);

export const PARAGON_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<ParagonState>> = Object.freeze({
  motivation: 0,
  maximumMotivation: 10,
  activeRefrain: ''
});

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
