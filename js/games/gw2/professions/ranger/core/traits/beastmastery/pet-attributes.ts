import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2NumericStatKey } from '#gw2/platform/combat/stats.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { weaponSetIncludes } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerModifierContext, RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Owns Beastmastery's companion and merged-player attribute and recharge policies independently of pet scheduling. */

/** Snapshot the family-specific strike bonus so launched pet attacks retain it across swaps. */
export function beastlyWardenPetDamageMultiplier(context: RangerRuntime | RangerResolverContext): number {
  const family = rangerPetByName(professionCoreState(context).activePet).family;
  return hasTrait(context, TRAIT.BEASTLY_WARDEN) && (family === 'ursine' || family === 'porcine')
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BEASTLY_WARDEN), 'damageMultiplier')
    : 1;
}

/** Reconciles the live weapon bonus against the calculated weapon baseline. */
export function honedAxesAttributeDelta(context: Gw2ModifierContext): number {
  if (!hasTrait(context, TRAIT.HONED_AXES)) return 0;
  const activeSet = Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1;
  const calculatedWeaponSet = Number(context.config?.attributeProvenance?.calculatedWeaponSet) === 2 ? 2 : 1;
  const profile = requireBalanceProfileFromContext(context, TRAIT.HONED_AXES);
  return (
    balanceProfileNumber(
      profile,
      weaponSetIncludes(context, activeSet, ['Axe']) ? 'weaponAttributeBonus' : 'attributeBonus'
    ) -
    (professionStaticRulesApplied(context.config)
      ? balanceProfileNumber(
          profile,
          weaponSetIncludes(context, calculatedWeaponSet, ['Axe']) ? 'weaponAttributeBonus' : 'attributeBonus'
        )
      : 0)
  );
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

/** Reconciles the merged trait bonus at Soulbeast's existing static/live boundary. */
export function applyPackAlphaMerged(
  context: RangerModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void,
  direction: number
): void {
  if (hasTrait(context, TRAIT.PACK_ALPHA)) {
    for (const attribute of PACK_ALPHA_RUNTIME_ATTRIBUTES) {
      const packAlphaProfile = requireBalanceProfileFromContext(context, TRAIT.PACK_ALPHA);
      adjust(attribute, direction * balanceProfileNumber(packAlphaProfile, 'attributeBonus'));
    }
  }
}

/** Reconciles the merged trait bonus at Soulbeast's existing static/live boundary. */
export function applyPetsProwessMerged(
  context: RangerModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void,
  direction: number
): void {
  if (hasTrait(context, TRAIT.PETS_PROWESS)) {
    const petsProwessProfile = requireBalanceProfileFromContext(context, TRAIT.PETS_PROWESS);
    adjust('ferocity', direction * balanceProfileNumber(petsProwessProfile, 'attributeBonus'));
  }
}

const PACK_ALPHA_RUNTIME_ATTRIBUTES = ['power', 'conditionDamage', 'precision', 'toughness', 'vitality'] as const;
