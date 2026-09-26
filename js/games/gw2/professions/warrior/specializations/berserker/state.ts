import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

export interface BerserkerState {
  berserkActive: boolean;
  berserkUntil: number;
  fireAuraUntil: number;
  kingOfFiresReadyAt: number;
  /** Actual completed activations let delayed hits react without reading action history. */
  completedActivations: Record<string, number>;
}

/** Declares Berserker's public mode fields and inactive values. */
export const BERSERKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  berserkActive: false,
  berserkUntil: 0
} satisfies Partial<BerserkerState>);

// Aura and proc deadlines are shared by the chronological Berserker reactions.
function createBerserkerState(): BerserkerState {
  return {
    berserkActive: false,
    berserkUntil: 0,
    // Aura acquisition, consumption, and expiry share this current window.
    fireAuraUntil: 0,
    kingOfFiresReadyAt: 0,
    completedActivations: {}
  };
}

export const berserkerState = defineProfessionSpecializationState('Berserker', createBerserkerState);
