import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { ParagonState } from "../../types.js";

export function createParagonState(): ParagonState {
  return {
    motivation: 0,
    maximumMotivation: 10,
    activeRefrain: "",
    nextRefrainAt: 0,
  };
}

export const paragonState = defineProfessionSpecializationState(
  "Paragon",
  createParagonState,
);
