import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

export interface VindicatorState {
  reaversCurseUntil: number;
  forerunnerOfDeathUntil: number;
}

export const VINDICATOR_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  reaversCurseUntil: 0,
  forerunnerOfDeathUntil: 0
} satisfies Partial<VindicatorState>);

export function createVindicatorState(): VindicatorState {
  return {
    // Timestamp-based flags: 0 means inactive; compared against event.at so 0 is safely "never".
    reaversCurseUntil: 0,
    forerunnerOfDeathUntil: 0
  };
}

// Both scheduler and resolver call create independently; state is NOT shared across phases.
export const vindicatorState = defineProfessionSpecializationState('Vindicator', createVindicatorState);
