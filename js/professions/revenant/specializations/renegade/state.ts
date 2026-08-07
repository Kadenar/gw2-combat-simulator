import type { RenegadeState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createRenegadeState(): RenegadeState {
  return {
    bandTogetherReady: false,
    bandTogetherExpiresAt: 0,
    kallasFervor: [],
    renegadeCriticalProgress: 0,
    razorclawsRage: {
      charges: 0,
      expiresAt: 0,
      readyAt: 0,
    },
  };
}

export const renegadeState = defineProfessionSpecializationState(
  "Renegade",
  createRenegadeState,
);
