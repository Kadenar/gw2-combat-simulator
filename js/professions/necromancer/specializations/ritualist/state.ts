import type { RitualistState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createRitualistState(): RitualistState {
  return {
    activeSpirits: {},
    spiritGenerations: {},
    spiritInitialUntil: {},
    spiritBusyUntil: {},
    // NaN signals "no anchor established yet"; first summon computes it from firstSpiritAttackDelay
    spiritAutoAnchorAt: Number.NaN,
    // true only between a re-summon and the next anchor computation (uses shorter resummonedSpiritAttackDelay)
    resummonedSpiritAutoCycle: false,
    weaponSpells: {},
    soulTwistingAvailable: false,
    pendingSoulTwistSkill: null,
    painfulBondUntil: 0,
    // NaN signals "no pulse scheduled yet"; first apply event sets the anchor
    painfulBondPulseAnchorAt: Number.NaN,
  };
}

export const ritualistState = defineProfessionSpecializationState(
  "Ritualist",
  createRitualistState,
);
