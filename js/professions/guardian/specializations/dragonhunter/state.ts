import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createDragonhunterState(): Record<string, never> {
  return {};
}

export const dragonhunterState = defineProfessionSpecializationState(
  "Dragonhunter",
  createDragonhunterState,
);
