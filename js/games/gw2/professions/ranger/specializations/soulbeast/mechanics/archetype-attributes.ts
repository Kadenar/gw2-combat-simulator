import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import type { Gw2NumericStatKey } from '#gw2/platform/combat/query/combat-query.js';
/** Build and runtime use the same patch values for the selected pet archetype. */
export function soulbeastArchetypeAttributes(
  context: unknown,
  archetype: string
): Readonly<Partial<Record<Gw2NumericStatKey, number>>> {
  switch (archetype) {
    case 'Stout':
      return {
        toughness: balanceProfileNumberFromContext(context, PROFILE.stoutArchetype, 'attributeBonus'),
        vitality: balanceProfileNumberFromContext(context, PROFILE.stoutArchetype, 'weaponAttributeBonus')
      };
    case 'Deadly':
      return {
        conditionDamage: balanceProfileNumberFromContext(context, PROFILE.deadlyArchetype, 'attributeBonus'),
        precision: balanceProfileNumberFromContext(context, PROFILE.deadlyArchetype, 'weaponAttributeBonus')
      };
    case 'Versatile':
      return {
        vitality: balanceProfileNumberFromContext(context, PROFILE.versatileArchetype, 'attributeBonus'),
        concentration: balanceProfileNumberFromContext(context, PROFILE.versatileArchetype, 'weaponAttributeBonus')
      };
    case 'Ferocious':
      return {
        power: balanceProfileNumberFromContext(context, PROFILE.ferociousArchetype, 'attributeBonus'),
        ferocity: balanceProfileNumberFromContext(context, PROFILE.ferociousArchetype, 'weaponAttributeBonus')
      };
    case 'Supportive':
      return { vitality: balanceProfileNumberFromContext(context, PROFILE.supportiveArchetype, 'attributeBonus') };
    default:
      return {};
  }
}
