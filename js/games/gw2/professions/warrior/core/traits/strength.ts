import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import {
  warriorActiveBuffStacks,
  warriorWieldingWeapon,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { WarriorResolverContext } from '#gw2/professions/warrior/types.js';
export const BRAVE_STRIDE_MOVEMENT_SKILL_IDS = Object.freeze([
  ID.SAVAGE_LEAP,
  ID.WHIRLWIND_ATTACK,
  ID.RUSH,
  ID.BRUTAL_SHOT,
  ID.VALIANT_LEAP,
  ID.LINE_BREAKER,
  ID.SPEAR_SWIPE,
  ID.AURA_SLICER,
  ID.GUNSTINGER,
  ID.DRAGONS_ROAR,
  ID.BULLS_CHARGE,
  ID.KICK,
  ID.STOMP,
  ID.EVISCERATE,
  ID.BREACHING_STRIKE,
  ID.EARTHSHAKER
]);
export function reactToWarriorBuff(context: WarriorResolverContext, event: Gw2ResolverEvent): void {
  if (Number(event.sourceId) !== TRAIT.PEAK_PERFORMANCE || event.kind !== 'peak-performance') return;
  context.recordProc('trait', 'Peak Performance', event.at, event.skillName, '+10% strike damage for 6 seconds');
}

// Resolve Strength-owned attributes without hiding their formulas in the cross-line composer.
export function modifyWarriorStrengthAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean,
  gearPower: number
): void {
  if (hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)) {
    const pinnacleOfStrengthProfile = requireBalanceProfileFromContext(context, PROFILE.pinnacleOfStrength);
    result.power +=
      Number(context.query?.mightStacksAt(context.time, context.runtime, context.event) || 0) *
      balanceProfileNumber(pinnacleOfStrengthProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.FORCEFUL_GREATSWORD) && !staticRulesApplied) {
    const forcefulGreatswordProfile = requireBalanceProfileFromContext(context, PROFILE.forcefulGreatsword);
    result.power +=
      balanceProfileNumber(forcefulGreatswordProfile, 'attributeBonus') +
      Number(warriorWieldingWeapon(context, 'Greatsword')) *
        balanceProfileNumber(forcefulGreatswordProfile, 'weaponAttributeBonus');
  }

  if (hasTrait(context, TRAIT.GREAT_FORTITUDE) && !staticRulesApplied) {
    const greatFortitudeProfile = requireBalanceProfileFromContext(context, PROFILE.greatFortitude);
    // Static builds already bake this gear-only conversion; live Might and signets must not feed it.
    const conversion = balanceProfileNumber(greatFortitudeProfile, 'attributeConversion');
    result.vitality += gearPower * conversion;
    result.ferocity += gearPower * conversion;
  }
}

export const warriorStrengthModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.pinnacle-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PINNACLE_OF_STRENGTH), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.PINNACLE_OF_STRENGTH)
  },
  {
    id: 'warrior.berserkers-power',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      maximumStacks: 4,
      damagePerStack: 0.0375
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      warriorActiveBuffStacks(context, 'berserkers-power', parameters.maximumStacks) * parameters.damagePerStack,
    when: (context) => hasTrait(context, TRAIT.BERSERKERS_POWER)
  },
  {
    id: 'warrior.peak-performance',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      baseBonus: 0.05,
      activeBonus: 0.1
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      parameters.baseBonus + (warriorActiveBuffStacks(context, 'peak-performance', 1) ? parameters.activeBonus : 0),
    when: (context) => hasTrait(context, TRAIT.PEAK_PERFORMANCE)
  }
]);
