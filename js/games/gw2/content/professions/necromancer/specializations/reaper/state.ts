import type { ReaperState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../../platform/engine/profession/state.js';
import { registerNecromancerStatePreserver } from '../../core/mechanics/state-reconciliation.js';

export function createReaperState(): ReaperState {
  const state: ReaperState = {
    // Expected-value proc progress and its ICD belong only to Reaper's Chilling Nova reaction.
    chillingNovaProgress: 0,
    chillingNovaReadyAt: 0,
    chillingVictoryReadyAt: 0
  };
  registerNecromancerStatePreserver(state, () => {
    // Resolver expected-progress and ICD state must not rewind when scheduler snapshots arrive.
    const chillingNovaProgress = state.chillingNovaProgress;
    const chillingNovaReadyAt = state.chillingNovaReadyAt;
    return () => {
      state.chillingNovaProgress = chillingNovaProgress;
      state.chillingNovaReadyAt = chillingNovaReadyAt;
    };
  });
  return state;
}

export const reaperState = defineProfessionSpecializationState('Reaper', createReaperState);
