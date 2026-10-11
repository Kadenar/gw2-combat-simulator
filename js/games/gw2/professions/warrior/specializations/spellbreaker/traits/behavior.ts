import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';

export function insightStacks(context: Gw2ModifierContext): number {
  const state = readProfessionSpecializationState<{ attackerInsightExpiries?: number[] }>(
    context.runtime?.profession,
    'Spellbreaker'
  );
  return activeStackCount(state?.attackerInsightExpiries || [], context.time);
}

export function spellbreakerStateAt(context: Gw2ModifierContext): {
  magebaneTetherUntil?: number;
} {
  return (
    readProfessionSpecializationState<{ magebaneTetherUntil?: number }>(context.runtime?.profession, 'Spellbreaker') ||
    {}
  );
}
