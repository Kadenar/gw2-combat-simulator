import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Additive Steal recharge retains each trait's independent reduction. */
export function leadAttacksRechargeReduction(runtime: MechanicQueriesOf<ThiefRuntime>): number {
  return (
    Number(hasTrait(runtime, TRAIT.LEAD_ATTACKS)) *
    (1 - balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.LEAD_ATTACKS), 'rechargeMultiplier'))
  );
}

/** Preview and runtime capacities use the same Preparedness branch. */
export function preparednessCapacityField(context: unknown): 'minimumStacks' | 'maximumStacks' {
  return hasTrait(context, TRAIT.PREPAREDNESS) ? 'minimumStacks' : 'maximumStacks';
}

/** Additive Steal recharge retains each trait's independent reduction. */
export function sleightOfHandRechargeReduction(runtime: MechanicQueriesOf<ThiefRuntime>): number {
  return (
    Number(hasTrait(runtime, TRAIT.SLEIGHT_OF_HAND)) *
    (1 - balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SLEIGHT_OF_HAND), 'rechargeMultiplier'))
  );
}
