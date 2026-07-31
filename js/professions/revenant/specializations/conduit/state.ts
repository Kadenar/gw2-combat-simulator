import type { ConduitState } from "../../types.js";

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
