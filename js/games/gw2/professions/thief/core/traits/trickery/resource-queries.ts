import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';

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

/** Lead Attacks stacks expire individually, so a siphon counts those active at its own impact. */
export function leadAttacksSiphonMultiplier(
  context: { readonly profession: unknown; readonly traits: unknown },
  at: number
): number {
  if (!hasTrait(context.traits, TRAIT.LEAD_ATTACKS)) return 1;
  const state = readProfessionCoreState<ThiefCoreState>(context.profession);
  const leadAttacksProfile = requireBalanceProfileFromContext(context, TRAIT.LEAD_ATTACKS);
  const stacks = Math.min(
    balanceProfileNumber(leadAttacksProfile, 'maximumStacks'),
    activeStackCount(state.leadAttackExpirations || [], at)
  );
  return 1 + stacks * balanceProfileNumber(leadAttacksProfile, 'damageIncreasePerStack');
}
