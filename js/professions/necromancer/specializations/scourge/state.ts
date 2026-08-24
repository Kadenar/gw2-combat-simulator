import type { ScourgeState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';
import { registerNecromancerStatePreserver } from '../../core/state-reconciliation.js';

export function createScourgeState(): ScourgeState {
  const state: ScourgeState = {
    // Each entry is an absolute expiry timestamp; the array length is the active shade count
    shades: [],
    demonicLoreReadyAt: 0,
    nourishingAshesReadyAt: 0
  };
  registerNecromancerStatePreserver(state, () => {
    // Demonic Lore's resolver ICD advances independently of scheduler-owned shade state.
    const demonicLoreReadyAt = state.demonicLoreReadyAt;
    return () => {
      state.demonicLoreReadyAt = demonicLoreReadyAt;
    };
  });
  return state;
}

/** Removes expired shades at the Scourge module boundary. */
export function purgeScourgeTimedState(state: ScourgeState, at: number): void {
  state.shades = state.shades.filter((expiresAt: number) => expiresAt > at);
}

// Both scheduler and resolver share the same factory — shade expiry is read in
// attribute rules (Sand Sage bonus) and must therefore be live in the resolver too
export const scourgeState = defineProfessionSpecializationState('Scourge', createScourgeState);
