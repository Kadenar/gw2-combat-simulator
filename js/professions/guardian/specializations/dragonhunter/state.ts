import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import type { GuardianDragonhunterState } from "../../types.js";

export function createDragonhunterState(): GuardianDragonhunterState {
  return {
    tetherUntil: 0,
    nextShieldOfCourageAegisAt: 0,
    heavyLightReadyAt: 0,
  };
}

export const dragonhunterState = defineProfessionSpecializationState(
  "Dragonhunter",
  createDragonhunterState,
);
