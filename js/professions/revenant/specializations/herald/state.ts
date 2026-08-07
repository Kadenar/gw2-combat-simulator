import type { HeraldState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createHeraldState(): HeraldState {
  return {};
}

export const heraldState = defineProfessionSpecializationState(
  "Herald",
  createHeraldState,
);
