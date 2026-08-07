import type {
  RevenantConfig,
  VindicatorState,
} from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createVindicatorState(
  config: RevenantConfig = {},
): VindicatorState {
  return {
    allianceSide: config.allianceSide === "kurzick" ? "kurzick" : "luxon",
    selectedDodge: config.selectedDodge || "Death Drop",
    reaversCurseUntil: 0,
    forerunnerOfDeathUntil: 0,
  };
}

export const vindicatorState = defineProfessionSpecializationState(
  "Vindicator",
  createVindicatorState,
);
