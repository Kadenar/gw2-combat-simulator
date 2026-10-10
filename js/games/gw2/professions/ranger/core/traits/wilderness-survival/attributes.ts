import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2NumericStatKey } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { rangerPetBaseAttributes } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { activePetFamily } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerModifierContext, RangerResolverContext, RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Adds Arachnophobia's family bonus to independent pet queries. */
export function applyArachnophobiaPetAttributes(
  context: RangerModifierContext,
  adjust: (attribute: Gw2NumericStatKey, amount: number) => void
): void {
  const family = activePetFamily(context);
  if (hasTrait(context, TRAIT.ARACHNOPHOBIA) && ['spider', 'devourer'].includes(family)) {
    const arachnophobiaProfile = requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA);
    adjust('expertise', balanceProfileNumber(arachnophobiaProfile, 'weaponAttributeBonus'));
  }
}

/** Adds Natural Vigor to both baseline and Vigor-enhanced endurance recovery. */
export function naturalVigorBonus(context: RangerRuntime): number {
  return hasTrait(context.traits, TRAIT.NATURAL_VIGOR)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.NATURAL_VIGOR),
        'vigorRegenerationMultiplier'
      )
    : 0;
}

/** Adds the trait's independent-pet attributes before packets snapshot them. */
export function applyArachnophobiaPet(
  context: RangerRuntime | RangerResolverContext,
  attributes: {
    -readonly [K in keyof ReturnType<typeof rangerPetBaseAttributes>]: ReturnType<typeof rangerPetBaseAttributes>[K];
  },
  petName: string
): void {
  if (hasTrait(context, TRAIT.ARACHNOPHOBIA)) {
    const arachnophobiaProfile = requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA);
    attributes.expertise += balanceProfileNumber(arachnophobiaProfile, 'attributeBonus');
    if (['spider', 'devourer'].includes(rangerPetByName(petName).family)) {
      attributes.expertise += balanceProfileNumber(arachnophobiaProfile, 'weaponAttributeBonus');
    }
  }
}
