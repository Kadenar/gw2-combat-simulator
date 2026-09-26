import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';
import type { RechargeProgress } from '#gw2/platform/engine/skills/recharge.js';

export interface SpellbreakerState {
  attackerInsightExpiries: number[];
  magebaneTetherUntil: number;
  magebaneTetherReadyAt: number;
  magebaneTetherRecharge: RechargeProgress | null;
}

/** Declares Spellbreaker's public fields and inactive values. */
export const SPELLBREAKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  attackerInsightExpiries: [],
  magebaneTetherUntil: 0,
  magebaneTetherReadyAt: 0
} satisfies Partial<SpellbreakerState>);

export function createSpellbreakerState(): SpellbreakerState {
  return {
    // Array of individual expiry timestamps rather than a stack count so each
    // stack can expire independently at the time it was gained.
    attackerInsightExpiries: [],
    magebaneTetherUntil: 0,
    magebaneTetherReadyAt: 0,
    magebaneTetherRecharge: null
  };
}

export const spellbreakerState = defineProfessionSpecializationState('Spellbreaker', createSpellbreakerState);
