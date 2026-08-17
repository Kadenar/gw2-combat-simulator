import type { ConduitState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createConduitState(): ConduitState {
  return {
    affinity: 0,
    affinityMaximum: 5,
    cosmicWisdomUntil: 0,
    // Empty string means no active form; presence is tested via revenantConduitFormIsActive, not a separate boolean.
    conduitForm: "",
    beguilingHazeCharges: 0,
    beguilingHazeReadyAt: 0,
    // Tracks in-flight main-cast reservations so follow-up charges arm exactly once per main cast, not per follow-up.
    beguilingHazeMainReservations: [],
    // Only populated during Mesmer form; cleared on form exit so native legend skill costs are restored.
    energyCostOverrides: {},
  };
}

export const conduitState = defineProfessionSpecializationState(
  "Conduit",
  createConduitState,
);
