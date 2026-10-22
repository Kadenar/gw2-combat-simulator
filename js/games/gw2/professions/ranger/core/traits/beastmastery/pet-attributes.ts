import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeEffect } from '#gw2/platform/attributes/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Owns Beastmastery's companion and merged-player attribute and recharge policies independently of pet scheduling. */

/** Snapshot the family-specific strike bonus so launched pet attacks retain it across swaps. */
export function beastlyWardenPetDamageMultiplier(context: RangerRuntime | RangerResolverContext): number {
  const family = rangerPetForState(professionCoreState(context)).family;
  return hasTrait(context, TRAIT.BEASTLY_WARDEN) && (family === 'ursine' || family === 'porcine')
    ? balanceNumberFromContext(context, TRAIT.BEASTLY_WARDEN, 'damageMultiplier')
    : 1;
}

/** Pet autonomous recharge uses Pack Alpha at scheduling, before action-rate scaling. */
export function packAlphaPetRecharge(context: RangerRuntime): number {
  return hasTrait(context, TRAIT.PACK_ALPHA)
    ? balanceNumberFromContext(context, TRAIT.PACK_ALPHA, 'rechargeMultiplier')
    : 1;
}

/** Declare independent pet bonuses at launch; family and selection cannot change an emitted snapshot. */
export function beastmasteryPetAttributes(
  context: RangerRuntime | RangerResolverContext
): readonly Gw2AttributeEffect[] {
  const declarations = [
    [TRAIT.PACK_ALPHA, ['Power', 'Precision', 'Toughness', 'Vitality', 'Condition Damage'], 'weaponAttributeBonus'],
    [TRAIT.HONED_AXES, ['Ferocity'], 'attributeBonus'],
    [TRAIT.PETS_PROWESS, ['Ferocity'], 'attributeBonus']
  ] as const;
  return declarations.flatMap(([id, attributes, field]) => {
    if (!hasTrait(context, id)) return [];

    const amount = balanceNumberFromContext(context, id, field);
    return attributes.map((to) => ({ kind: 'flat' as const, to, amount, feedsConversions: 'none' }));
  });
}
