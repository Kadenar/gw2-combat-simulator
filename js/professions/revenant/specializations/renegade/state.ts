import type { RenegadeState } from '../../types.js';
import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';

export const RENEGADE_PUBLIC_END_STATE_KEYS: readonly (keyof RenegadeState)[] = Object.freeze([
  'bandTogetherReady',
  'bandTogetherExpiresAt',
  'kallasFervor',
  'razorclawsRage'
]);

export const RENEGADE_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<Partial<RenegadeState>> = Object.freeze({
  bandTogetherReady: false,
  bandTogetherExpiresAt: 0,
  kallasFervor: [],
  razorclawsRage: {
    charges: 0,
    expiresAt: 0,
    readyAt: 0
  }
});

export function createRenegadeState(): RenegadeState {
  return {
    // bandTogetherReady + bandTogetherExpiresAt together form the one-use enhancement window; both must be checked because the flag alone doesn't expire itself
    bandTogetherReady: false,
    bandTogetherExpiresAt: 0,
    // each element records the application timestamp and expiry; the array is pruned lazily
    kallasFervor: [],
    // synchronized from the active patchable Kalla's Fervor profile
    kallasFervorMaximumStacks: 5,
    // fractional crit accumulator for deterministic mode: carries forward the leftover probability between events so that expected crit count is preserved across the full simulation
    renegadeCriticalProgress: 0,
    razorclawsRage: {
      charges: 0,
      expiresAt: 0,
      // readyAt enforces the per-hit internal cooldown between Razorclaw bleeds
      readyAt: 0
    },
    // Specialization timers stay with Renegade so Core upkeep and trait state remains profession-generic.
    soulcleaveNextAlliedProcAt: null,
    endlessEnmityReadyAt: 0,
    bloodFuryReadyAt: 0,
    soulcleaveReadyAt: 0
  };
}

export const renegadeState = defineProfessionSpecializationState('Renegade', createRenegadeState);
