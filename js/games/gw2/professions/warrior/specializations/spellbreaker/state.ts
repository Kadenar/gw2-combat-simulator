import {
  definePublicStateDefaults,
  defineProfessionSpecializationState
} from '#gw2/platform/engine/profession/state.js';

export interface SpellbreakerState {
  attackerInsightExpiries: number[];
  fullCounterActiveUntil: number;
  magebaneTetherUntil: number;
  magebaneTetherReadyAt: number;
}

/** Declares Spellbreaker's public compatibility fields and inactive values. */
export const SPELLBREAKER_PUBLIC_STATE_PROJECTION = definePublicStateDefaults({
  attackerInsightExpiries: [],
  fullCounterActiveUntil: 0,
  magebaneTetherUntil: 0,
  magebaneTetherReadyAt: 0
} satisfies Partial<SpellbreakerState>);

export function createSpellbreakerState(): SpellbreakerState {
  return {
    // Array of individual expiry timestamps rather than a stack count so each
    // stack can expire independently at the time it was gained.
    attackerInsightExpiries: [],
    fullCounterActiveUntil: 0,
    magebaneTetherUntil: 0,
    magebaneTetherReadyAt: 0
  };
}

export const spellbreakerState = defineProfessionSpecializationState('Spellbreaker', createSpellbreakerState);
