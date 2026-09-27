import {
  snapshotProfessionState,
  projectPublicProfessionState,
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';

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

/** Keeps Dragonhunter projection ownership beside the state that produces it. */
export const DRAGONHUNTER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  tetherUntil: 0
} satisfies Partial<GuardianDragonhunterState>);

export const dragonhunterState = defineProfessionSpecializationState('Dragonhunter', createDragonhunterState);

/** Hides the expired tether at observation time while its flip retains its own expiry task. */
export function projectDragonhunterPlanningState(input: Gw2PlanningStateInput) {
  const state = snapshotProfessionState(input.profession) as GuardianDragonhunterState;
  if (state.tetherUntil <= input.time) state.tetherUntil = 0;
  return projectPublicProfessionState(
    state,
    DRAGONHUNTER_PUBLIC_STATE_PROJECTION.keys,
    DRAGONHUNTER_PUBLIC_STATE_PROJECTION.defaults
  );
}
