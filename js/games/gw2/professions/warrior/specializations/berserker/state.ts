import {
  defineProfessionSpecializationState,
  definePublicStateDefaults
} from '#gw2/platform/profession-definition/state.js';

export interface BerserkerState {
  /** Null is inactive; the expiry task clears finite windows and previews may hold Infinity. */
  berserkUntil: number | null;
  fireAuraUntil: number;

  /** Actual completed activations let delayed hits react without reading action history. */
  completedActivations: Record<string, number>;
}

/** Declares Berserker's public mode fields and inactive values. */
export const BERSERKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  berserkUntil: null
} satisfies Partial<BerserkerState>);

// Aura and proc deadlines are shared by the chronological Berserker reactions.
function createBerserkerState(): BerserkerState {
  return {
    berserkUntil: null,
    // Aura acquisition, consumption, and expiry share this current window.
    fireAuraUntil: 0,

    completedActivations: {}
  };
}

export const berserkerState = defineProfessionSpecializationState('Berserker', createBerserkerState);
