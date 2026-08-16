import type { ScourgeState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createScourgeState(): ScourgeState {
  return {
    // Each entry is an absolute expiry timestamp; the array length is the active shade count
    shades: [],
  };
}

// Both scheduler and resolver share the same factory — shade expiry is read in
// attribute rules (Sand Sage bonus) and must therefore be live in the resolver too
export const scourgeState = defineProfessionSpecializationState(
  "Scourge",
  createScourgeState,
);
