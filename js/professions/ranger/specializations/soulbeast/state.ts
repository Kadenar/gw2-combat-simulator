import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import { selectedRangerPet } from "../../core/state.js";
import type { RangerConfig, SoulbeastState } from "../../types.js";

export function createSoulbeastState(
  config: RangerConfig = {},
): SoulbeastState {
  const pet = selectedRangerPet(config);
  return {
    beastmodeActive: true,
    archetype: pet?.archetype || "",
    oneWolfPackUntil: 0,
    oneWolfPackReadyAt: 0,
  };
}

export const soulbeastState = defineProfessionSpecializationState(
  "Soulbeast",
  createSoulbeastState,
);
