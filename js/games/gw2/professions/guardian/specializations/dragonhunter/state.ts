import {
  defineProfessionSpecializationState,
  type SpecializationRuntimeState
} from '#gw2/platform/profession-definition/state.js';
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

/** Hide expired tether observations without clearing the live deadline; its flip owns its expiry task. */
export function projectDragonhunterPlanningState(input: Gw2PlanningStateInput<SpecializationRuntimeState>) {
  const state = dragonhunterState.from(input.profession);

  return { [STATE.TETHER_UNTIL]: state.tetherUntil > input.time ? state.tetherUntil : 0 };
}
