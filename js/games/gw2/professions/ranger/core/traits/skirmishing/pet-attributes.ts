import { ownerAttributeEffects } from '#gw2/platform/attributes/passives.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2AttributeEffect } from '#gw2/platform/attributes/types.js';

import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Declare independent pet bonuses at launch; family and selection cannot change an emitted snapshot. */
export function skirmishingPetAttributes(
  context: RangerRuntime | RangerResolverContext,
  family: string
): readonly Gw2AttributeEffect[] {
  const declarations = [
    [TRAIT.STRIDERS_STRENGTH, 'attributeBonuses'],
    [TRAIT.FANG_AND_CLAW, 'attributeBonuses']
  ] as const;
  return declarations.flatMap(([id, field]) => {
    if (!hasTrait(context, id)) return [];

    if (id === TRAIT.FANG_AND_CLAW && !['feline', 'avian', 'drake'].includes(family)) return [];

    const profile = requireBalanceProfileFromContext(context, id);
    return ownerAttributeEffects({ attributeBonuses: profile[field] });
  });
}
