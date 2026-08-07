import type { ScourgeState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createScourgeState(): ScourgeState {
  return {
    shades: [],
  };
}

export const scourgeState = defineProfessionSpecializationState(
  "Scourge",
  createScourgeState,
);
