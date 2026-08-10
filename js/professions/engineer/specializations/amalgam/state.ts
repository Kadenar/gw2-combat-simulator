import type { AmalgamState, EngineerConfig } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createAmalgamState(config: EngineerConfig = {}): AmalgamState {
  return {
    selectedMorphSkillIds: [...(config.selectedMorphSkillIds || [])],
    evolvedUntil: 0,
    willingHostUntil: 0,
    plasmaticStateUntil: 0,
    plasmaticLockoutUntil: 0,
    thornsUntil: 0,
    rapaciousUntil: 0,
    predatorUntil: 0,
    titanicUntil: 0,
    berserkerUntil: 0,
    activeStances: {},
  };
}

export const amalgamState = defineProfessionSpecializationState(
  "Amalgam",
  createAmalgamState,
);
