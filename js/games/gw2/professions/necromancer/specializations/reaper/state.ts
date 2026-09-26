import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export interface ReaperState {
  chillingNovaReadyAt: number;
  chillingVictoryReadyAt: number;
}

/** Creates the owned Reaper trait clocks for one simulation. */
export function createReaperState(): ReaperState {
  const state: ReaperState = {
    chillingNovaReadyAt: 0,
    chillingVictoryReadyAt: 0
  };
  return state;
}

export const reaperState = defineProfessionSpecializationState('Reaper', createReaperState);
