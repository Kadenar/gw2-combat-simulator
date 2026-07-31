import type { RitualistState } from "../../types.js";

export function createRitualistState(): RitualistState {
  return {
    activeSpirits: {},
    spiritGenerations: {},
    spiritInitialUntil: {},
    spiritBusyUntil: {},
    spiritAutoAnchorAt: Number.NaN,
    weaponSpells: {},
    soulTwistingAvailable: false,
    pendingSoulTwistSkill: null,
    painfulBondUntil: 0,
    painfulBondPulseAnchorAt: Number.NaN,
  };
}
