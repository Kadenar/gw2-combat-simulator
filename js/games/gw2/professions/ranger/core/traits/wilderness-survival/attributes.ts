import { ownerAttributeEffects } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeEffect } from '#gw2/platform/attributes/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceNumberFromContext, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Adds Natural Vigor to both baseline and Vigor-enhanced endurance recovery. */
export function naturalVigorBonus(context: RangerRuntime): number {
  return hasTrait(context.traits, TRAIT.NATURAL_VIGOR)
    ? balanceNumberFromContext(context, TRAIT.NATURAL_VIGOR, 'vigorRegenerationMultiplier')
    : 0;
}

/** Declare independent pet bonuses at launch; family and selection cannot change an emitted snapshot. */
export function wildernessPetAttributes(
  context: RangerRuntime | RangerResolverContext,
  family: string
): readonly Gw2AttributeEffect[] {
  const declarations = [
    [TRAIT.ARACHNOPHOBIA, 'attributeBonuses'],
    [TRAIT.ARACHNOPHOBIA, 'conditionalAttributeBonuses']
  ] as const;
  return declarations.flatMap(([id, field]) => {
    if (!hasTrait(context, id)) return [];

    if (field === 'conditionalAttributeBonuses' && !['spider', 'devourer'].includes(family)) return [];

    const profile = requireBalanceProfileFromContext(context, id);
    return ownerAttributeEffects({ attributeBonuses: profile[field] });
  });
}
