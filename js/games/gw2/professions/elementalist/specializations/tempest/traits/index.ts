import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

export const galeSong = defineTrait({
  id: TRAIT.GALE_SONG,
  name: 'Gale Song',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  }
});

export const latentStamina = defineTrait({
  id: TRAIT.LATENT_STAMINA,
  name: 'Latent Stamina',
  balance: {
    internalCooldown: 10,
    effects: [{ type: 'boon', name: 'Vigor', boon: 'vigor', stacks: 1, duration: 3 }]
  }
});

export const tempestuousAria = defineTrait({
  id: TRAIT.TEMPESTUOUS_ARIA,
  name: 'Tempestuous Aria',
  balance: {
    // Each aura extends the damage buff by `durationMultiplier` seconds, capped `maximumStacks`
    // seconds past the triggering aura; `Shout Might` is the separate shout-completion payload.
    maximumStacks: 10,
    durationMultiplier: 5,
    effects: [{ type: 'boon', name: 'Shout Might', boon: 'might', stacks: 2, duration: 10 }]
  },
  modifierRules: [
    {
      id: 'elementalist.tempestuous-aria-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => elementalistTimedBuffStacks(context, 'tempestuous aria', 1) > 0
    },
    {
      id: 'elementalist.tempestuous-aria-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.05,
      when: (context) => elementalistTimedBuffStacks(context, 'tempestuous aria', 1) > 0
    }
  ]
});

export const invigoratingTorrents = defineTrait({
  id: TRAIT.INVIGORATING_TORRENTS,
  name: 'Invigorating Torrents',
  balance: {
    effects: [
      { type: 'boon', name: 'Vigor', boon: 'vigor', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Regeneration', boon: 'regeneration', stacks: 1, duration: 5 }
    ]
  }
});

export const elementalBastion = defineTrait({
  id: TRAIT.ELEMENTAL_BASTION,
  name: 'Elemental Bastion',
  balance: {
    effects: [{ type: 'boon', name: 'Alacrity', boon: 'alacrity', stacks: 1, duration: 4 }]
  }
});

export const unstableConduit = defineTrait({
  id: TRAIT.UNSTABLE_CONDUIT,
  name: 'Unstable Conduit',
  balance: {
    // One entry per attunement: the completing overload looks its aura duration up by
    // attunement name, so the effect `name` is the lookup key rather than the aura's name.
    effects: [
      {
        type: 'buff',
        name: 'Fire',
        kind: 'Fire Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Water',
        kind: 'Frost Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Air',
        kind: 'Shocking Aura',
        stacks: 1,
        duration: 4
      },
      {
        type: 'buff',
        name: 'Earth',
        kind: 'Magnetic Aura',
        stacks: 1,
        duration: 4
      }
    ]
  }
});

export const gatheredFocus = defineTrait({
  id: TRAIT.GATHERED_FOCUS,
  name: 'Gathered Focus',
  balance: {
    attributeBonus: 240
  },
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        source: 'Gathered Focus',
        to: 'Concentration',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.GATHERED_FOCUS),
          'attributeBonus'
        ),
        feedsConversions: false
      }
    ]
  })
});

export const hardyConduit = defineTrait({
  id: TRAIT.HARDY_CONDUIT,
  name: 'Hardy Conduit',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => Boolean(cast.skill.overload),
      emit: TRAIT.HARDY_CONDUIT,
      effects: (effect) => effect.type === 'boon' && ['Protection'].some((name) => name === effect.name),
      attribution: (_runtime, cast) => ({
        source: 'Hardy Conduit',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillName: 'Hardy Conduit',
        name: 'Hardy Conduit',
        offTarget: cast.command.offTarget
      })
    }
  ]
});

export const harmoniousConduit = defineTrait({
  id: TRAIT.HARMONIOUS_CONDUIT,
  name: 'Harmonious Conduit',
  balance: {
    effects: [
      { type: 'boon', name: 'Swiftness', boon: 'swiftness', stacks: 1, duration: 8 },
      { type: 'boon', name: 'Stability', boon: 'stability', stacks: 1, duration: 4 }
    ]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => Boolean(cast.skill.overload),
      emit: TRAIT.HARMONIOUS_CONDUIT,
      effects: (effect) => effect.type === 'boon' && ['Swiftness', 'Stability'].some((name) => name === effect.name),
      attribution: (_runtime, cast) => ({
        source: 'Harmonious Conduit',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillName: 'Harmonious Conduit',
        name: 'Harmonious Conduit',
        offTarget: cast.command.offTarget
      })
    }
  ]
});

export const transcendentTempest = defineTrait({
  id: TRAIT.TRANSCENDENT_TEMPEST,
  name: 'Transcendent Tempest',
  balance: {
    // Completion grants the timed damage-bonus status from this profile.
    effects: [{ type: 'buff', name: 'Transcendent Tempest', kind: 'transcendent-tempest', duration: 7, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'elementalist.transcendent-tempest-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.25,
      when: (context) => elementalistTimedBuffStacks(context, 'transcendent-tempest', 1) > 0
    },
    {
      id: 'elementalist.transcendent-tempest-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.2,
      when: (context) => elementalistTimedBuffStacks(context, 'transcendent-tempest', 1) > 0
    }
  ],
  triggers: [
    {
      emit: TRAIT.TRANSCENDENT_TEMPEST,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.overload),
      // Apply before final overload packets and same-time completion strikes.
      attribution: (_runtime, cast) => ({
        source: 'Transcendent Tempest',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: 'Transcendent Tempest',
        priority: -10,
        offTarget: cast.command.offTarget
      })
    }
  ]
});

export const lucidSingularity = defineTrait({
  id: TRAIT.LUCID_SINGULARITY,
  name: 'Lucid Singularity',
  balance: {
    // At most `maximumStacks` overload hits pulse alacrity; the last of them uses `Final Alacrity`.
    maximumStacks: 5,
    effects: [
      { type: 'boon', name: 'Pulse Alacrity', boon: 'alacrity', stacks: 1, duration: 1 },
      { type: 'boon', name: 'Final Alacrity', boon: 'alacrity', stacks: 1, duration: 4.5 }
    ]
  }
});
/** Register tempest traits in their existing execution order. */
export const tempestTraits = [
  galeSong,
  latentStamina,
  unstableConduit,
  gatheredFocus,
  hardyConduit,
  tempestuousAria,
  harmoniousConduit,
  invigoratingTorrents,
  transcendentTempest,
  lucidSingularity,
  elementalBastion
];
