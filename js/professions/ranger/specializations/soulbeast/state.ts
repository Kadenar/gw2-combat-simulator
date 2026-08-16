import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import { selectedRangerPet } from "../../core/state.js";
import type { RangerConfig, SoulbeastState } from "../../types.js";

export function createSoulbeastState(
  config: RangerConfig = {},
): SoulbeastState {
  const pet = selectedRangerPet(config);
  return {
    // Soulbeast starts merged — the rotation begins in Beastmode by default.
    beastmodeActive: true,
    archetype: pet?.archetype || "",
    oneWolfPackUntil: 0,
    oneWolfPackReadyAt: 0,
    goForTheEyesReadyAt: 0,
    beastlyWardenReadyAt: 0,
    goForTheThroatReadyAt: 0,
    bestialRageReadyAt: 0,
    essenceOfSpeedReadyAt: 0,
    vultureStanceReadyAt: 0,
    // Tracks per-activation-id whether the beast-ability first-hit proc already fired, preventing multi-hit skills from triggering trait effects more than once per cast.
    beastAbilityActivations: {},
  };
}

export const soulbeastState = defineProfessionSpecializationState(
  "Soulbeast",
  createSoulbeastState,
);
