import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Owns Beastmastery's companion and merged-player attribute and recharge policies independently of pet scheduling. */

/** Snapshot the family-specific strike bonus so launched pet attacks retain it across swaps. */
export function beastlyWardenPetDamageMultiplier(context: RangerRuntime | RangerResolverContext): number {
  const family = rangerPetByName(professionCoreState(context).activePet).family;
  return hasTrait(context, TRAIT.BEASTLY_WARDEN) && (family === 'ursine' || family === 'porcine')
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BEASTLY_WARDEN), 'damageMultiplier')
    : 1;
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyPackAlphaPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  }
): void {
  if (hasTrait(context, TRAIT.PACK_ALPHA)) {
    const packAlphaProfile = requireBalanceProfileFromContext(context, TRAIT.PACK_ALPHA);
    const bonus = balanceProfileNumber(packAlphaProfile, 'weaponAttributeBonus');
    attributes.power += bonus;
    attributes.precision += bonus;
    attributes.toughness += bonus;
    attributes.vitality += bonus;
    attributes.conditionDamage += bonus;
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyHonedAxesPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  }
): void {
  if (hasTrait(context, TRAIT.HONED_AXES)) {
    const honedAxesProfile = requireBalanceProfileFromContext(context, TRAIT.HONED_AXES);
    attributes.ferocity += balanceProfileNumber(honedAxesProfile, 'attributeBonus');
  }
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyPetsProwessPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  }
): void {
  if (hasTrait(context, TRAIT.PETS_PROWESS)) {
    const petsProwessProfile = requireBalanceProfileFromContext(context, TRAIT.PETS_PROWESS);
    attributes.ferocity += balanceProfileNumber(petsProwessProfile, 'attributeBonus');
  }
}

/** Pet autonomous recharge uses Pack Alpha at scheduling, before action-rate scaling. */
export function packAlphaPetRecharge(context: RangerRuntime): number {
  return hasTrait(context, TRAIT.PACK_ALPHA)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PACK_ALPHA), 'rechargeMultiplier')
    : 1;
}
