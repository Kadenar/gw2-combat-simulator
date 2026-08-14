import type { ReaperState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createReaperState(): ReaperState {
  return {};
}

export const reaperState = defineProfessionSpecializationState(
  "Reaper",
  createReaperState,
);
