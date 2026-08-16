import type { ScrapperState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

// Scrapper carries no persistent per-phase state of its own; proc timestamps
// (massMomentum, appliedForce, massMomentumPulseAt) live in the shared procState bag.
export function createScrapperState(): ScrapperState {
  return {};
}

export const scrapperState = defineProfessionSpecializationState(
  "Scrapper",
  createScrapperState,
);
