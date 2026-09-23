import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import type { Gw2NumericStatKey } from '#gw2/platform/combat/query/combat-query.js';
/** Build and runtime use the same patch values for the selected pet archetype. */
export function soulbeastArchetypeAttributes(
  context: unknown,
  archetype: string
): Readonly<Partial<Record<Gw2NumericStatKey, number>>> {
  switch (archetype) {
    case 'Stout':
      const stoutArchetypeProfile = requireBalanceProfileFromContext(context, PROFILE.stoutArchetype);
      return {
        toughness: balanceProfileNumber(stoutArchetypeProfile, 'attributeBonus'),
        vitality: balanceProfileNumber(stoutArchetypeProfile, 'weaponAttributeBonus')
      };
    case 'Deadly':
      const deadlyArchetypeProfile = requireBalanceProfileFromContext(context, PROFILE.deadlyArchetype);
      return {
        conditionDamage: balanceProfileNumber(deadlyArchetypeProfile, 'attributeBonus'),
        precision: balanceProfileNumber(deadlyArchetypeProfile, 'weaponAttributeBonus')
      };
    case 'Versatile':
      const versatileArchetypeProfile = requireBalanceProfileFromContext(context, PROFILE.versatileArchetype);
      return {
        vitality: balanceProfileNumber(versatileArchetypeProfile, 'attributeBonus'),
        concentration: balanceProfileNumber(versatileArchetypeProfile, 'weaponAttributeBonus')
      };
    case 'Ferocious':
      const ferociousArchetypeProfile = requireBalanceProfileFromContext(context, PROFILE.ferociousArchetype);
      return {
        power: balanceProfileNumber(ferociousArchetypeProfile, 'attributeBonus'),
        ferocity: balanceProfileNumber(ferociousArchetypeProfile, 'weaponAttributeBonus')
      };
    case 'Supportive':
      const supportiveArchetypeProfile = requireBalanceProfileFromContext(context, PROFILE.supportiveArchetype);
      return { vitality: balanceProfileNumber(supportiveArchetypeProfile, 'attributeBonus') };
    default:
      return {};
  }
}
