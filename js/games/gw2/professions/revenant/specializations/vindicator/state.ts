import type { VindicatorState } from '#gw2/professions/revenant/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export const VINDICATOR_PUBLIC_END_STATE_KEYS: readonly (keyof VindicatorState)[] = Object.freeze([
  'reaversCurseUntil',
  'forerunnerOfDeathUntil'
]);

export const VINDICATOR_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<VindicatorState>> = Object.freeze({
  reaversCurseUntil: 0,
  forerunnerOfDeathUntil: 0
});

export function createVindicatorState(): VindicatorState {
  return {
    // Timestamp-based flags: 0 means inactive; compared against event.at so 0 is safely "never".
    reaversCurseUntil: 0,
    forerunnerOfDeathUntil: 0
  };
}

// Both scheduler and resolver call create independently; state is NOT shared across phases.
export const vindicatorState = defineProfessionSpecializationState('Vindicator', createVindicatorState);
