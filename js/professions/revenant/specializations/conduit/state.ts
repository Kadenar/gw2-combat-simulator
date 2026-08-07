import type { ConduitState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createConduitState(): ConduitState {
  return {
    affinity: 0,
    cosmicWisdomUntil: 0,
    conduitForm: "",
    beguilingHazeCharges: 0,
    beguilingHazeReadyAt: 0,
    beguilingHazeMainReservations: [],
    energyCostOverrides: {},
  };
}

export const conduitState = defineProfessionSpecializationState(
  "Conduit",
  createConduitState,
);
