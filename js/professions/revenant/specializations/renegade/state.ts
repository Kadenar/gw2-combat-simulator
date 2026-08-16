import type { RenegadeState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createRenegadeState(): RenegadeState {
  return {
    // bandTogetherReady + bandTogetherExpiresAt together form the one-use enhancement window; both must be checked because the flag alone doesn't expire itself
    bandTogetherReady: false,
    bandTogetherExpiresAt: 0,
    // each element records the application timestamp and expiry; the array is pruned lazily
    kallasFervor: [],
    // fractional crit accumulator for deterministic mode: carries forward the leftover probability between events so that expected crit count is preserved across the full simulation
    renegadeCriticalProgress: 0,
    razorclawsRage: {
      charges: 0,
      expiresAt: 0,
      // readyAt enforces the per-hit internal cooldown between Razorclaw bleeds
      readyAt: 0,
    },
  };
}

export const renegadeState = defineProfessionSpecializationState(
  "Renegade",
  createRenegadeState,
);
