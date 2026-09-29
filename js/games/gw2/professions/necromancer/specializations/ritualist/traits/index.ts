import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { necromancerRuntimeSpecializationState } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Owns Spirits' Strength tuning and behavior at its existing execution boundaries. */
export const spiritsStrength = defineTrait({
  id: TRAIT.SPIRITS_STRENGTH,
  name: "Spirits' Strength",
  balance: { damageMultiplier: 1.5 },
  modifierRules: [
    {
      order: 123,
      id: 'necromancer.spirits-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SPIRITS_STRENGTH), 'damageMultiplier'),
      when: (context) =>
        (context.event?.actorType === 'summon' || context.event?.summonKind === 'spirit') &&
        // Innervate attacks are player-buffed abilities, not spirit autonomous attacks; the trait does not apply to them
        context.event.metadata?.spiritAttackType !== 'innervate'
    }
  ]
});

/** Owns Explosive Growth tuning and behavior at its existing execution boundaries. */
export const explosiveGrowth = defineTrait({
  id: TRAIT.EXPLOSIVE_GROWTH,
  name: 'Explosive Growth',
  balance: {
    categories: ['Trait'],
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1.2, hits: 1, actorType: 'effect' }]
  }
});

/** Owns Boon of Creation tuning and behavior at its existing execution boundaries. */
export const boonOfCreation = defineTrait({
  id: TRAIT.BOON_OF_CREATION,
  name: 'Boon of Creation',
  balance: { categories: ['Trait'], attributeBonus: 180, lifeForceGain: 10, effects: [] },
  buildAttributes: (_common, { balanceContext: profileContext }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        source: 'Boon of Creation',
        to: 'Concentration',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(profileContext, TRAIT.BOON_OF_CREATION),
          'attributeBonus'
        ),
        feedsConversions: false
      }
    ]
  })
});

/** Owns Empowering Spirits tuning and behavior at its existing execution boundaries. */
export const empoweringSpirits = defineTrait({
  id: TRAIT.EMPOWERING_SPIRITS,
  name: 'Empowering Spirits',
  balance: {
    categories: ['Trait'],
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        stacks: 1,
        duration: 3.75,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        stacks: 8,
        duration: 10,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 5,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        name: 'resolution',
        type: 'boon',
        boon: 'resolution',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
});

/** Owns Lingering Spirits tuning and behavior at its existing execution boundaries. */
export const lingeringSpirits = defineTrait({
  id: TRAIT.LINGERING_SPIRITS,
  name: 'Lingering Spirits',
  modifierRules: [
    {
      order: 1,
      id: 'necromancer.lingering-spirits',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.05,
      when: (context) => Boolean(necromancerRuntimeSpecializationState(context, 'Ritualist').activeSpirits?.anguish)
    }
  ]
});

/** Owns Soul Twisting's ordered mechanic integration. */
export const soulTwisting = defineTrait({ id: TRAIT.SOUL_TWISTING, name: 'Soul Twisting' });

/** Owns Wielder's Boon's ordered mechanic integration. */
export const wieldersBoon = defineTrait({ id: TRAIT.WIELDERS_BOON, name: "Wielder's Boon" });

/** Registers each native trait owner once in its existing execution order. */
export const necromancerRitualistTraits = [
  spiritsStrength,
  explosiveGrowth,
  boonOfCreation,
  empoweringSpirits,
  lingeringSpirits,
  soulTwisting,
  wieldersBoon
];
