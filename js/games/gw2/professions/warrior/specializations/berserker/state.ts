import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { BerserkerState } from '#gw2/professions/warrior/types.js';

/** Declares Berserker's public compatibility fields and inactive values. */
export const BERSERKER_PUBLIC_END_STATE_KEYS = Object.freeze([
  'berserkActive',
  'berserkUntil'
] as const satisfies readonly (keyof BerserkerState)[]);

export const BERSERKER_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<BerserkerState>> = Object.freeze({
  berserkActive: false,
  berserkUntil: 0
});

// kingOfFiresCriticalProgress accumulates fractional crit probability in
// deterministic mode so that expected crits fire at the statistically correct rate.
export function createBerserkerState(): BerserkerState {
  return {
    berserkActive: false,
    berserkUntil: 0,
    fireAuraUntil: 0,
    kingOfFiresReadyAt: 0,
    kingOfFiresCriticalProgress: 0
  };
}

export const berserkerState = defineProfessionSpecializationState('Berserker', createBerserkerState);
