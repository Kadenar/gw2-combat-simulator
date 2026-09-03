import type { ScourgeState } from '#gw2/professions/necromancer/types.js';
import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { registerNecromancerStatePreserver } from '#gw2/professions/necromancer/core/mechanics/state-reconciliation.js';

/** Declares Scourge's public compatibility field and inactive value. */
export const SCOURGE_PUBLIC_END_STATE_KEYS = Object.freeze([
  'shades'
] as const satisfies readonly (keyof ScourgeState)[]);

export const SCOURGE_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<ScourgeState>> = Object.freeze({ shades: [] });

/** Creates Scourge's timed shade and trait-cooldown runtime state. */
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
