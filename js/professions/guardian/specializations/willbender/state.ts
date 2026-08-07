import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createWillbenderState(): Record<string, never> {
  return {};
}

export const willbenderState = defineProfessionSpecializationState(
  "Willbender",
  createWillbenderState,
);
