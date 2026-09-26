import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';

import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import {
  cloneNecromancerAttributes,
  necromancerRuntimeSpecializationState
} from '#gw2/professions/necromancer/core/modifiers.js';

import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';

// Apply Scourge's static conversion and live-shade attribute bonuses from their authoritative inputs.
function modifyScourgeAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  if (!professionStaticRulesApplied(context.config) && hasTrait(context, TRAIT.FELL_BEACON)) {
    const fellBeaconProfile = requireBalanceProfileFromContext(context, PROFILE.fellBeacon);
    // Fell Beacon converts 7% of condition damage into expertise; must use raw
    // gear stats (config.stats) not the merged attribute record because might
    // stacks and trait bonuses like Lingering Curse are already folded in there
    result.expertise +=
      Number(context.config?.stats?.conditionDamage || 0) *
      balanceProfileNumber(fellBeaconProfile, 'attributeConversion');
  }

  if (
    hasTrait(context, TRAIT.SAND_SAGE) &&
    // Bonus only applies when at least one shade is alive — check expiry timestamps against current sim time
    (necromancerRuntimeSpecializationState(context, 'Scourge').shades || []).some(
      (expiresAt: number) => expiresAt > context.time
    )
  ) {
    const sandSageProfile = requireBalanceProfileFromContext(context, PROFILE.sandSage);
    const bonus = balanceProfileNumber(sandSageProfile, 'attributeBonus');
    // Dynamic attribute queries may begin from sparse input stats, so normalize
    // absent duration attributes before applying Sand Sage's active-shade bonus.
    result.concentration = Number(result.concentration || 0) + bonus;
    result.expertise = Number(result.expertise || 0) + bonus;
  }

  return result;
}

const scourgeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'necromancer.fell-beacon',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => context.condition === 'Burning' && hasTrait(context, TRAIT.FELL_BEACON)
  },
  {
    id: 'necromancer.demonic-lore',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.33,
    order: 100,
    when: (context) => context.condition === 'Torment' && hasTrait(context, TRAIT.DEMONIC_LORE)
  }
]);

export const scourgeModifiers = Object.freeze({
  modifyAttributes: modifyScourgeAttributes,
  modifierRules: scourgeModifierRules
});
