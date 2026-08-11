import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { RangerConfig, UntamedState } from "../../types.js";

export function createUntamedState(config: RangerConfig = {}): UntamedState {
  return {
    rangerUnleashed: config.initialUntamedState === "Ranger",
    ambushReadyUntil: 0,
    unleashedPowerReadyAt: 0,
    letLooseReadyAt: 0,
    debilitatingBlowsReadyAt: 0,
    enhancingImpactReadyAt: 0,
    ferociousSymbiosisPlayerStacks: 0,
    ferociousSymbiosisPlayerUntil: 0,
    ferociousSymbiosisPlayerReadyAt: 0,
    ferociousSymbiosisPetStacks: 0,
    ferociousSymbiosisPetUntil: 0,
    ferociousSymbiosisPetReadyAt: 0,
    letLooseActivations: {},
  };
}

export const untamedState = defineProfessionSpecializationState(
  "Untamed",
  createUntamedState,
);
