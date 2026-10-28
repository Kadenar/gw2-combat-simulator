import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
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

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectVindicatorPlanningState(input: Gw2PlanningStateInput) {
  const state = vindicatorState.from(input);
  return structuredClone({
    [STATE.REAVERS_CURSE_UNTIL]: state.reaversCurseUntil
  });
}
