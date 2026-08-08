import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { RangerConfig, UntamedState } from "../../types.js";

export function createUntamedState(config: RangerConfig = {}): UntamedState {
  return {
    rangerUnleashed: config.initialUntamedState === "Ranger",
    ambushReadyUntil: 0,
  };
}

export const untamedState = defineProfessionSpecializationState(
  "Untamed",
  createUntamedState,
);
