import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { registerNecromancerResolverFields } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';

export interface ReaperState {
  chillingNovaReadyAt: number;
  chillingVictoryReadyAt: number;
}

/** Creates isolated Reaper trait proc state with snapshot-preserved Chilling Nova progress. */
export function createReaperState(): ReaperState {
  const state: ReaperState = {
    chillingNovaReadyAt: 0,
    chillingVictoryReadyAt: 0
  };
  // Chilling Victory remains scheduler-owned; only Chilling Nova advances in the resolver.
  registerNecromancerResolverFields(state, ['chillingNovaReadyAt']);
  return state;
}

export const reaperState = defineProfessionSpecializationState('Reaper', createReaperState);
