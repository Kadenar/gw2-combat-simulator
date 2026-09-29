import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  targetHealthBelow,
  targetHealthFraction,
  vulnerabilityStacks
} from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { activeOffhand } from '#gw2/professions/revenant/core/traits/behavior.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Owns Assassin's Presence tuning and behavior at its established execution boundaries. */
export const assassinsPresence = defineTrait({
  id: TRAIT.ASSASSINS_PRESENCE,
  name: "Assassin's Presence",
  balance: {
    id: TRAIT.ASSASSINS_PRESENCE,
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 10,
    effects: [
      {
        name: 'fury',
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Battle Scarred tuning and behavior at its established execution boundaries. */
export const battleScarred = defineTrait({
  id: TRAIT.BATTLE_SCARRED,
  name: 'Battle Scarred',
  balance: {
    id: TRAIT.BATTLE_SCARRED,
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'battle-scars',
        type: 'buff',
        kind: 'battle-scars',
        duration: 10,
        stacks: 5,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Brutality tuning and behavior at its established execution boundaries. */
export const brutality = defineTrait({
  id: TRAIT.BRUTALITY,
  name: 'Brutality',
  balance: {
    id: TRAIT.BRUTALITY,
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 9,
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Dance of Death tuning and behavior at its established execution boundaries. */
export const danceOfDeath = defineTrait({ id: TRAIT.DANCE_OF_DEATH, name: 'Dance of Death' });

/** Owns Destructive Impulses tuning and behavior at its established execution boundaries. */
export const destructiveImpulses = defineTrait({
  id: TRAIT.DESTRUCTIVE_IMPULSES,
  name: 'Destructive Impulses',
  modifierRules: [
    {
      id: 'revenant.destructive-impulses',
      order: 5,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context) => (activeOffhand(context) ? 0.075 : 0.05),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Expose Defenses tuning and behavior at its established execution boundaries. */
export const exposeDefensesTrait = defineTrait({
  id: TRAIT.EXPOSE_DEFENSES,
  name: 'Expose Defenses',
  balance: {
    id: TRAIT.EXPOSE_DEFENSES,
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 5,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Notoriety tuning and behavior at its established execution boundaries. */
export const notoriety = defineTrait({
  id: TRAIT.NOTORIETY,
  name: 'Notoriety',
  balance: {
    id: TRAIT.NOTORIETY,
    attributePerStack: 10,
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 2,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Swift Termination tuning and behavior at its established execution boundaries. */
export const swiftTermination = defineTrait({
  id: TRAIT.SWIFT_TERMINATION,
  name: 'Swift Termination',
  modifierRules: [
    {
      id: 'revenant.swift-termination',
      order: 8,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.2,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetHealthBelow(context, 0.5)
    }
  ]
});

/** Owns Targeted Destruction tuning and behavior at its established execution boundaries. */
export const targetedDestruction = defineTrait({
  id: TRAIT.TARGETED_DESTRUCTION,
  name: 'Targeted Destruction',
  modifierRules: [
    {
      id: 'revenant.targeted-destruction',
      order: 7,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + vulnerabilityStacks(context) * 0.005,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Thrill of Combat tuning and behavior at its established execution boundaries. */
export const thrillOfCombatTrait = defineTrait({
  id: TRAIT.THRILL_OF_COMBAT,
  name: 'Thrill of Combat',
  balance: {
    id: TRAIT.THRILL_OF_COMBAT,
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 1,
    effects: [
      {
        name: 'battle-scars',
        type: 'buff',
        kind: 'battle-scars',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Unsuspecting Strikes tuning and behavior at its established execution boundaries. */
export const unsuspectingStrikes = defineTrait({
  id: TRAIT.UNSUSPECTING_STRIKES,
  name: 'Unsuspecting Strikes',
  modifierRules: [
    {
      id: 'revenant.unsuspecting-strikes',
      order: 6,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.2,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetHealthFraction(context) > 0.8
    }
  ]
});
