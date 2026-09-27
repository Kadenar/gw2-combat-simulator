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

function createVindicatorState(): VindicatorState {
  return {
    // Timestamp-based flags: 0 means inactive; compared against event.at so 0 is safely "never".
    reaversCurseUntil: 0,
    forerunnerOfDeathUntil: 0
  };
}

// Vindicator's slice of the single live runtime state.
export const vindicatorState = defineProfessionSpecializationState('Vindicator', createVindicatorState);
