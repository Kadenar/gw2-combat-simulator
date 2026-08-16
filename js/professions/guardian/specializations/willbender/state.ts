import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { GuardianWillbenderState } from "../../types.js";

export function createWillbenderState(): GuardianWillbenderState {
  return {
    flameGeneration: 0, // increments each time a different virtue activates, invalidating queued pulses from the prior virtue
    flameVirtue: null,
    pendingWeaponCooldownReduction: {}, // keyed by reservationId; accumulates in-flight reductions and cleared on cast-complete
    justiceUntil: 0,
    resolveUntil: 0,
    courageUntil: 0,
    virtueHitCounts: {
      justice: 0,
      resolve: 0,
      courage: 0,
    },
    lethalTempoStacks: 0,
    lethalTempoUntil: 0,
    triggeredVirtueEffects: 0,
  };
}

export const willbenderState = defineProfessionSpecializationState(
  "Willbender",
  createWillbenderState,
);
