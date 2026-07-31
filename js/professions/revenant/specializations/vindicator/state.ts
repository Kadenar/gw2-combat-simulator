import type {
  RevenantConfig,
  VindicatorState,
} from "../../types.js";

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
