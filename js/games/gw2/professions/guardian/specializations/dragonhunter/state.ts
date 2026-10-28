import { defineProfessionSpecializationState, cloneStateFields } from '#gw2/platform/profession-definition/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/results/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

export interface GuardianDragonhunterState {
  tetherUntil: number;
  tetherActivationId: string | null;
}

function createDragonhunterState(): GuardianDragonhunterState {
  return {
    tetherUntil: 0, // sim time at which the Spear of Justice tether expires; 0 = no tether
    tetherActivationId: null
  };
}

export const dragonhunterState = defineProfessionSpecializationState('Dragonhunter', createDragonhunterState);

/** Detach only the public tether deadline before hiding expiry; its flip retains its own expiry task. */
export function projectDragonhunterPlanningState(input: Gw2PlanningStateInput) {
  const state = cloneStateFields(dragonhunterState.from(input), ['tetherUntil']);

  if (state.tetherUntil <= input.time) state.tetherUntil = 0;

  return { [STATE.TETHER_UNTIL]: state.tetherUntil };
}
