import { defineProfessionSpecializationState } from '../../../../platform/engine/profession/state.js';
import type { SpellbreakerState } from '../../types.js';

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
