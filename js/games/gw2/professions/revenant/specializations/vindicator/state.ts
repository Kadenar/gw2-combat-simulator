import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface VindicatorState {
  reaversCurseUntil: number;
}

function createVindicatorState(): VindicatorState {
  return {
    // Timestamp-based flags: 0 means inactive; compared against event.at so 0 is safely "never".
    reaversCurseUntil: 0
  };
}

// Vindicator's slice of the single live runtime state.
export const vindicatorState = defineProfessionSpecializationState('Vindicator', createVindicatorState);

/** Select public fields without mutating their owner; the planning observer detaches the result. */
export function projectVindicatorPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = vindicatorState.from(input.profession);
  return {
    [STATE.REAVERS_CURSE_UNTIL]: state.reaversCurseUntil
  };
}
