import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

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
