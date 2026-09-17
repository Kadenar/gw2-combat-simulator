import { defineProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';

export interface SpellbreakerState {
  attackerInsightExpiries: number[];
  fullCounterActiveUntil: number;
  magebaneTetherUntil: number;
  magebaneTetherReadyAt: number;
}

/** Declares Spellbreaker's public compatibility fields and inactive values. */
export const SPELLBREAKER_PUBLIC_END_STATE_KEYS = Object.freeze([
  'attackerInsightExpiries',
  'fullCounterActiveUntil',
  'magebaneTetherUntil',
  'magebaneTetherReadyAt'
] as const satisfies readonly (keyof SpellbreakerState)[]);

export const SPELLBREAKER_PUBLIC_END_STATE_DEFAULTS: Readonly<Partial<SpellbreakerState>> = Object.freeze({
  attackerInsightExpiries: [],
  fullCounterActiveUntil: 0,
  magebaneTetherUntil: 0,
  magebaneTetherReadyAt: 0
});

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
