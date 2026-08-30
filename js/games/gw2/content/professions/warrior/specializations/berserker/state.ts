import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { BerserkerState } from '#gw2/content/professions/warrior/types.js';

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
