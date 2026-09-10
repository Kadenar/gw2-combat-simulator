import type { ReaperState } from '#gw2/professions/necromancer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { registerNecromancerResolverFields } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';

/** Creates isolated Reaper trait proc state with snapshot-preserved Chilling Nova progress. */
export function createReaperState(): ReaperState {
  const state: ReaperState = {
    // Expected-value proc progress and its ICD belong only to Reaper's Chilling Nova reaction.
    chillingNovaProgress: 0,
    chillingNovaReadyAt: 0,
    chillingVictoryReadyAt: 0
  };
  // Chilling Victory remains scheduler-owned; only Chilling Nova advances in the resolver.
  registerNecromancerResolverFields(state, ['chillingNovaProgress', 'chillingNovaReadyAt']);
  return state;
}

export const reaperState = defineProfessionSpecializationState('Reaper', createReaperState);
