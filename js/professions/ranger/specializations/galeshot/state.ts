import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { GaleshotState, RangerConfig } from "../../types.js";

export function createGaleshotState(config: RangerConfig = {}): GaleshotState {
  return {
    cycloneBowActive: false,
    arrows: Math.max(0, Math.min(8, Number(config.initialArrows ?? 8))),
    maximumArrows: 8,
    arrowsUpdatedAt: 0,
    windForce: 0,
  };
}

export const galeshotState = defineProfessionSpecializationState(
  "Galeshot",
  createGaleshotState,
);
