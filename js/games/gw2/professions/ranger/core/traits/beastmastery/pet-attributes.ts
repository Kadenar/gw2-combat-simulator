import { ownerAttributeEffects } from '#gw2/platform/attributes/passives.js';

import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeEffect } from '#gw2/platform/attributes/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireBalanceProfileFromContext, balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
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
    [TRAIT.PACK_ALPHA, 'conditionalAttributeBonuses'],
    [TRAIT.HONED_AXES, 'attributeBonuses'],
    [TRAIT.PETS_PROWESS, 'attributeBonuses']
  ] as const;
  return declarations.flatMap(([id, field]) => {
    if (!hasTrait(context, id)) return [];

    const profile = requireBalanceProfileFromContext(context, id);
    return ownerAttributeEffects({ attributeBonuses: profile[field] });
  });
}
