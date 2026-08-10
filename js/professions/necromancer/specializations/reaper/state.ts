import type { ReaperState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createReaperState(): ReaperState {
  return {
    executionersIceFieldUntil: 0,
    projectileFinisherChillProgress: 0,
  };
}

export const reaperState = defineProfessionSpecializationState(
  "Reaper",
  createReaperState,
);
