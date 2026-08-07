import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";
import {
  hasEngineerTrait,
  selectedEngineerTraits,
} from "../../core/state.js";
import type {
  EngineerConfig,
  HolosmithState,
} from "../../types.js";

export function createHolosmithState(
  config: EngineerConfig = {},
): HolosmithState {
  const traits = selectedEngineerTraits(config);
  const maximumHeat = hasEngineerTrait(
    traits,
    TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
  ) ? 150 : 100;
  const initialHeat = Math.min(
    maximumHeat,
    Math.max(0, Number(config.initialHeat || 0)),
  );
  return {
    heat: initialHeat,
    maximumHeat,
    heatUpdatedAt: 0,
    photonForgeActive: false,
    forgeExitedAt: initialHeat > 0 ? 0 : null,
    overheated: false,
    solarFocusingLensStacks: 0,
    solarFocusingLensReadyAt: 0,
    solarFocusingLensUntil: 0,
    enhancedCapacityMightReadyAt: null,
    kitLockoutUntil: 0,
  };
}

export const holosmithState = defineProfessionSpecializationState(
  "Holosmith",
  createHolosmithState,
);
