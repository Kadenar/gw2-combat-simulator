import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeEffect } from '#gw2/platform/attributes/types.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Declare independent pet bonuses at launch; family and selection cannot change an emitted snapshot. */
export function skirmishingPetAttributes(
  context: RangerRuntime | RangerResolverContext,
  family: string
): readonly Gw2AttributeEffect[] {
  const declarations = [
    [TRAIT.STRIDERS_STRENGTH, ['Power'], 'attributeBonus'],
    [TRAIT.FANG_AND_CLAW, ['Precision'], 'attributeBonus'],
    [TRAIT.FANG_AND_CLAW, ['Ferocity'], 'weaponAttributeBonus']
  ] as const;
  return declarations.flatMap(([id, attributes, field]) => {
    if (!hasTrait(context, id)) return [];

    if (id === TRAIT.FANG_AND_CLAW && !['feline', 'avian', 'drake'].includes(family)) return [];

    const amount = balanceNumberFromContext(context, id, field);
    return attributes.map((to) => ({ kind: 'flat' as const, to, amount, feedsConversions: 'none' }));
  });
}
