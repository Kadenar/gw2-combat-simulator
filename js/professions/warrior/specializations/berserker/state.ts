import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { BerserkerState } from "../../types.js";

export function createBerserkerState(): BerserkerState {
  return {
    berserkActive: false,
    berserkUntil: 0,
    fireAuraUntil: 0,
    kingOfFiresReadyAt: 0,
    kingOfFiresCriticalProgress: 0,
  };
}

export const berserkerState = defineProfessionSpecializationState(
  "Berserker",
  createBerserkerState,
);
