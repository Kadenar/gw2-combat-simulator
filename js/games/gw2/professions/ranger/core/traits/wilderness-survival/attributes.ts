import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeEffect } from '#gw2/platform/builds/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Adds Natural Vigor to both baseline and Vigor-enhanced endurance recovery. */
export function naturalVigorBonus(context: RangerRuntime): number {
  return hasTrait(context.traits, TRAIT.NATURAL_VIGOR)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.NATURAL_VIGOR),
        'vigorRegenerationMultiplier'
      )
    : 0;
}

/** Declare independent pet bonuses at launch; family and selection cannot change an emitted snapshot. */
export function wildernessPetAttributes(
  context: RangerRuntime | RangerResolverContext,
  family: string
): readonly Gw2AttributeEffect[] {
  const declarations = [
    [TRAIT.ARACHNOPHOBIA, ['Expertise'], 'attributeBonus'],
    [TRAIT.ARACHNOPHOBIA, ['Expertise'], 'weaponAttributeBonus']
  ] as const;
  return declarations.flatMap(([id, attributes, field]) => {
    if (!hasTrait(context, id)) return [];
    if (field === 'weaponAttributeBonus' && !['spider', 'devourer'].includes(family)) return [];
    const amount = balanceProfileNumber(requireBalanceProfileFromContext(context, id), field);
    return attributes.map((to) => ({ kind: 'flat' as const, to, amount, feedsConversions: false }));
  });
}
