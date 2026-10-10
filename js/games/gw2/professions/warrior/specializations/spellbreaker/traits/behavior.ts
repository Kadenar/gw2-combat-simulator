import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';

import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

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

export function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as Gw2MutableStats & {
    power: number;
    precision: number;
    ferocity: number;
  };
  const attackersInsightProfile = requireBalanceProfileFromContext(context, TRAIT.ATTACKERS_INSIGHT);
  const bonus = insightStacks(context) * balanceProfileNumber(attackersInsightProfile, 'attributePerStack');
  result.power += bonus;
  result.precision += bonus;
  result.ferocity += bonus;
  return result;
}
