import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';

import type { Gw2Stats } from '#gw2/platform/combat/types.js';

import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2MutableStats } from '#gw2/platform/combat/types.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';

// Current mode state is authoritative for both combat modifiers and isolated attribute previews.
function active(context: Gw2ModifierContext): boolean {
  return Boolean(
    readProfessionSpecializationState<{ berserkActive?: boolean }>(context.runtime?.profession, 'Berserker')
      ?.berserkActive
  );
}

// Apply Berserker's live trait and Berserk-window attribute changes without
// mutating the shared resolved-stat object.
function modifyAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const conversionPower = Number(context.config?.stats?.power ?? attributes.power ?? 0);
  const conversionPrecision = Number(context.config?.stats?.precision ?? attributes.precision ?? 0);
  const result = { ...attributes } as Gw2MutableStats & {
    power: number;
    precision: number;
    ferocity: number;
    conditionDamage: number;
  };
  if (active(context)) {
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    const powerBonus = balanceProfileNumber(resourcesProfile, 'attributeBonus');
    result.power += powerBonus;
    result.conditionDamage += balanceProfileNumber(resourcesProfile, 'attributePerStack');
    if (hasTrait(context, TRAIT.GREAT_FORTITUDE)) {
      const greatFortitudeProfile = requireBalanceProfileFromContext(context, CORE_PROFILE.greatFortitude);
      const conversion = balanceProfileNumber(greatFortitudeProfile, 'attributeConversion');
      result.vitality = Number(result.vitality || 0) + powerBonus * conversion;
      result.ferocity += powerBonus * conversion;
    }
  }

  if (hasTrait(context, TRAIT.BLOOD_REACTION)) {
    const bloodReactionProfile = requireBalanceProfileFromContext(context, PROFILE.bloodReaction);
    const conversion = active(context)
      ? balanceProfileNumber(bloodReactionProfile, 'coefficientMultiplier')
      : balanceProfileNumber(bloodReactionProfile, 'attributeConversion');
    result.ferocity += conversionPrecision * conversion;
    result.conditionDamage += conversionPower * conversion;
  }

  return result;
}

const modifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.smash-brawler-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SMASH_BRAWLER), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.SMASH_BRAWLER) && active(context)
  },
  {
    id: 'warrior.bloody-roar',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.BLOODY_ROAR) && active(context)
  }
]);

export const berserkerAttributeRules = Object.freeze({
  modifyAttributes,
  modifierRules
});
