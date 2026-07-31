import type { RenegadeState } from "../../types.js";

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
