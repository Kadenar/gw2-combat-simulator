import { purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { defineProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface ScourgeState {
  shadeGeneration: number;
  shades: number[];
}

/** Creates Scourge's timed shade and trait-cooldown runtime state. */
function createScourgeState(): ScourgeState {
  const state: ScourgeState = {
    shadeGeneration: 0,
    // Each entry is an absolute expiry timestamp; the array length is the active shade count
    shades: []
  };
  return state;
}

/** Removes expired shades at the Scourge module boundary. */
export function purgeScourgeTimedState(state: ScourgeState, at: number): void {
  state.shades = purgeExpiredStacks(state.shades, at);
}

// Shade lifetime and Sand Sage attributes read the same state.
export const scourgeState = defineProfessionSpecializationState('Scourge', createScourgeState);

/** Publish detached, typed observations from this module's owner under stable public IDs. */
export function projectScourgePlanningState(input: Gw2PlanningStateInput) {
  const state = scourgeState.from(input);
  return structuredClone({
    [STATE.SHADES]: state.shades
  });
}
