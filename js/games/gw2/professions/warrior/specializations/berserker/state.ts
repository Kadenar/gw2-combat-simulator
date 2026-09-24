import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

export interface BerserkerState {
  berserkActive: boolean;
  berserkUntil: number;
  fireAuraUntil: number;
  kingOfFiresReadyAt: number;
}

/** Declares Berserker's public compatibility fields and inactive values. */
export const BERSERKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  berserkActive: false,
  berserkUntil: 0
} satisfies Partial<BerserkerState>);

// Aura and proc deadlines are shared by the chronological Berserker reactions.
function createBerserkerState(): BerserkerState {
  return {
    berserkActive: false,
    berserkUntil: 0,
    // Scheduler aura observation and detonation tasks own this window; resolver state leaves it at zero.
    fireAuraUntil: 0,
    kingOfFiresReadyAt: 0
  };
}

export const berserkerState = defineProfessionSpecializationState('Berserker', createBerserkerState);
