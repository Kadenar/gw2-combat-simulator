import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, playerHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { REVENANT_ELITE_INVOCATIONS } from '#gw2/professions/revenant/family-state.js';

/** Owns Charged Mists tuning and behavior at its established execution boundaries. */
export const chargedMists = defineTrait({
  id: TRAIT.CHARGED_MISTS,
  name: 'Charged Mists',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    resourceGain: 75,
    threshold: 10,
    effects: []
  }
});

/** Owns Ferocious Aggression tuning and behavior at its established execution boundaries. */
export const ferociousAggression = defineTrait({
  id: TRAIT.FEROCIOUS_AGGRESSION,
  name: 'Ferocious Aggression',
  balance: { damageIncrease: 0.1 },
  modifierRules: [
    {
      id: 'revenant.ferocious-aggression',
      order: 0,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_AGGRESSION), 'damageIncrease'),
      // Grant the bonus only while permanent or simulated Fury affects the player.
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, 'fury')
    }
  ]
});

/** Owns Incensed Response tuning and behavior at its established execution boundaries. */
export const incensedResponse = defineTrait({
  id: TRAIT.INCENSED_RESPONSE,
  name: 'Incensed Response',
  balance: {
    effects: [{ name: 'might', type: 'boon', boon: 'might', duration: 8, stacks: 5 }]
  },
  triggers: [
    {
      on: 'buff.applied',
      when: (runtime, event) =>
        event.kind === 'fury' &&
        runtime.combatStartedAt() &&
        isGw2PlayerModifierOwnedEvent(event) &&
        gw2BoonApplicationRecipients(runtime.config, event).includesSelf,
      emit: TRAIT.INCENSED_RESPONSE,
      effects: (effect) => effect.type === 'boon' && effect.name === 'might',
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.INCENSED_RESPONSE,
        actorType: 'player',
        skillId: TRAIT.INCENSED_RESPONSE,
        skillName: 'Incensed Response',
        name: undefined
      }
    }
  ]
});

/** Owns Invoker's Rage tuning and behavior at its established execution boundaries. */
export const invokersRage = defineTrait({
  id: TRAIT.INVOKERS_RAGE,
  name: "Invoker's Rage",
  balance: {
    effects: [{ type: 'boon', boon: 'fury', duration: 5, stacks: 1 }]
  }
});

/** Owns Rising Tide tuning and behavior at its established execution boundaries. */
export const risingTide = defineTrait({
  id: TRAIT.RISING_TIDE,
  name: 'Rising Tide',
  modifierRules: [
    {
      id: 'revenant.rising-tide',
      order: 1,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && playerHealthFraction(context) > 0.75
    }
  ]
});

/** Owns Roiling Mists tuning and behavior at its established execution boundaries. */
export const roilingMists = defineTrait({
  id: TRAIT.ROILING_MISTS,
  name: 'Roiling Mists',
  balance: { criticalChance: 0.25 }
});

/** Owns Song of the Mists tuning and behavior at its established execution boundaries. */
export const songOfTheMists = defineTrait({ id: TRAIT.SONG_OF_THE_MISTS, name: 'Song of the Mists' });

/** Owns Spirit Boon tuning and behavior at its established execution boundaries. */
export const spiritBoon = defineTrait({
  id: TRAIT.SPIRIT_BOON,
  name: 'Spirit Boon',
  profiles: [
    {
      id: TRAIT.SPIRIT_BOON,
      name: 'Spirit Boon (Core Legends)',
      profileKind: 'trait',

      categories: ['Trait'],
      skillFamily: 'Trait',
      effects: [
        {
          type: 'boon',
          boon: 'might',
          duration: 10,
          stacks: 2,
          actorType: 'player',
          metadata: { legendId: LEGEND.ASSASSIN }
        },
        {
          type: 'boon',
          boon: 'resistance',
          duration: 2,
          stacks: 1,
          actorType: 'player',
          metadata: { legendId: LEGEND.DEMON }
        },
        {
          type: 'boon',
          boon: 'stability',
          duration: 3,
          stacks: 1,
          actorType: 'player',
          metadata: { legendId: LEGEND.DWARF }
        },
        {
          type: 'boon',
          boon: 'regeneration',
          duration: 5,
          stacks: 1,
          actorType: 'player',
          metadata: { legendId: LEGEND.CENTAUR }
        }
      ]
    },
    {
      id: REVENANT_ELITE_INVOCATIONS[LEGEND.DRAGON].spiritBoon,
      name: 'Spirit Boon (Dragon)',
      profileKind: 'trait',

      description: 'Invoking Legendary Dragon grants protection to nearby allies.',
      icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png',
      effects: [
        {
          type: 'boon',
          boon: 'protection',
          duration: 3,
          stacks: 1,
          actorType: 'player'
        }
      ]
    },
    {
      id: REVENANT_ELITE_INVOCATIONS[LEGEND.RENEGADE].spiritBoon,
      name: 'Spirit Boon (Renegade)',
      profileKind: 'trait',

      description: 'Invoking Legendary Renegade grants resolution to nearby allies.',
      icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png',
      categories: ['Trait'],
      skillFamily: 'Trait',
      effects: [
        {
          type: 'boon',
          boon: 'resolution',
          duration: 4,
          stacks: 1,
          actorType: 'player'
        }
      ]
    },
    {
      id: REVENANT_ELITE_INVOCATIONS[LEGEND.ALLIANCE].spiritBoon,
      name: 'Spirit Boon (Alliance)',
      profileKind: 'trait',

      effects: [
        {
          type: 'boon',
          boon: 'vigor',
          duration: 4,
          stacks: 1,
          actorType: 'player'
        }
      ]
    }
  ]
});
