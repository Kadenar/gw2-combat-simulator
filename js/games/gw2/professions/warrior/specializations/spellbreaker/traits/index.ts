import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { spellbreakerStateAt } from '#gw2/professions/warrior/specializations/spellbreaker/traits/behavior.js';

/** Owns this trait's tuning and selected contributions. */
export const attackersInsight = defineTrait({
  id: TRAIT.ATTACKERS_INSIGHT,
  name: "Attacker's Insight",
  balance: {
    maximumStacks: 5,
    attributePerStack: 50,
    effects: [{ name: 'attackers-insight', type: 'buff', kind: 'attackers-insight', stacks: 1, duration: 15 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const magebaneTether = defineTrait({
  id: TRAIT.MAGEBANE_TETHER,
  name: 'Magebane Tether',
  balance: {
    cooldownPolicy: 'playerRecharge',
    cooldown: 12,
    effects: [{ name: 'magebane-tether', type: 'buff', kind: 'magebane-tether', stacks: 1, duration: 8 }]
  },
  modifierRules: [
    {
      id: 'warrior.magebane-tether',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      order: 110,
      when: (context) => (spellbreakerStateAt(context).magebaneTetherUntil || 0) > context.time
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const noEscape = defineTrait({
  id: TRAIT.NO_ESCAPE,
  name: 'No Escape',
  balance: {
    effects: [{ name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1 }]
  },
  triggers: [
    {
      order: 0,
      on: 'control.resolved',

      emit: TRAIT.NO_ESCAPE,
      when: (_runtime, event) =>
        event.actorType === 'player' && ['daze', 'stun'].includes(String(event.controlKind).toLowerCase()),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Immobilized',
      attribution: { source: 'Trait', sourceId: TRAIT.NO_ESCAPE, actorType: 'effect', name: 'No Escape - Immobilized' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const pureStrike = defineTrait({
  id: TRAIT.PURE_STRIKE,
  name: 'Pure Strike',
  balance: {
    // Targets have no boons, so the supported bonus is a single critical-damage multiplier.
    criticalDamage: 1.1
  },
  modifierRules: [
    {
      order: 9,
      id: 'warrior.pure-strike',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      // The target never has boons, so the full bonus always applies.
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PURE_STRIKE), 'criticalDamage')
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const sunAndMoonStyle = defineTrait({
  id: TRAIT.SUN_AND_MOON_STYLE,
  name: 'Sun and Moon Style',
  modifierRules: [
    {
      id: 'warrior.sun-and-moon-style',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      order: 100,
      when: (context) =>
        gw2PrimaryWeapon(context.config, Number(context.runtime?.activeWeaponSet) === 2 ? 2 : 1) === 'Dagger'
    }
  ]
});

/** Native specialization prerequisite; intrinsic resource state remains shared with the mode owner. */
export const spellbreakersConviction = defineTrait({
  id: TRAIT.SPELLBREAKERS_CONVICTION,
  name: "Spellbreaker's Conviction"
});

/** Register native owners once in declaration order. */
export const warriorSpellbreakerTraits = [
  spellbreakersConviction,
  attackersInsight,
  magebaneTether,
  noEscape,
  pureStrike,
  sunAndMoonStyle
] as const;
