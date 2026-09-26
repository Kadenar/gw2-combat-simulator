import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import {
  warriorActiveBoonCount,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
// Resolve Tactics-owned attributes without hiding their formulas in the cross-line composer.
export function modifyWarriorTacticsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  if (hasTrait(context, TRAIT.ROARING_REVEILLE) && !staticRulesApplied) {
    const roaringReveilleProfile = requireBalanceProfileFromContext(context, PROFILE.roaringReveille);
    result.concentration += balanceProfileNumber(roaringReveilleProfile, 'attributeBonus');
  }
}

export const warriorTacticsModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.empowered',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerBoon: 0.01 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + warriorActiveBoonCount(context) * parameters.damagePerBoon,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.EMPOWERED)
  },
  {
    id: 'warrior.leg-specialist',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.LEG_SPECIALIST) &&
      ['Crippled', 'Chilled', 'Immobilized'].some((condition) => targetConditionActive(context, condition))
  },
  {
    id: 'warrior.warriors-cunning',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.WARRIORS_CUNNING) && targetHealthFraction(context) > 0.8
  }
]);
