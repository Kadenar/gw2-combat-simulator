import type { RitualistState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createRitualistState(): RitualistState {
  return {
    activeSpirits: {},
    spiritGenerations: {},
    spiritInitialUntil: {},
    spiritBusyUntil: {},
    spiritAutoAnchorAt: Number.NaN,
    resummonedSpiritAutoCycle: false,
    weaponSpells: {},
    soulTwistingAvailable: false,
    pendingSoulTwistSkill: null,
    painfulBondUntil: 0,
    painfulBondPulseAnchorAt: Number.NaN,
  };
}

export const ritualistState = defineProfessionSpecializationState(
  "Ritualist",
  createRitualistState,
);
