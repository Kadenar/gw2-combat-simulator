import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';

/** Owns Soaring Devastation's tuning and behavior at the existing Dragonhunter boundaries. */
export const soaringDevastation = defineTrait({
  id: TRAIT.SOARING_DEVASTATION,
  name: 'Soaring Devastation',
  balance: {
    effects: [
      { type: 'strike', name: 'Strike', coefficient: 1.5, hits: 1 },
      {
        type: 'condition',
        name: 'Immobilized',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3
      }
    ]
  }
});

/** Owns Big Game Hunter's tuning and behavior at the existing Dragonhunter boundaries. */
export const bigGameHunter = defineTrait({
  id: TRAIT.BIG_GAME_HUNTER,
  name: 'Big Game Hunter',
  balance: {
    pulseInterval: 12,
    effects: [
      {
        type: 'condition',
        name: 'Vulnerability',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10
      }
    ]
  },
  modifierRules: [
    {
      id: 'guardian.dragonhunter.big-game-hunter',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      order: 100,
      // Uses context.time (resolver clock), not event.at, because modifier rules
      // are evaluated at the moment damage resolves, not when it was scheduled.
      when: (context) => dragonhunterState.from(context).tetherUntil > context.time
    }
  ],
  triggers: [
    {
      order: 1,
      emit: TRAIT.BIG_GAME_HUNTER,
      on: 'damage.resolved',
      when: (runtime, event, details) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        (details.hitContext?.damage ?? 0) > 0 &&
        dragonhunterState.from(runtime).tetherUntil > runtime.time,
      effects: (effect) => effect.type === 'condition' && effect.name === 'Vulnerability',
      attribution: (_runtime, event) => ({
        source: 'guardian',
        actorType: 'effect',
        skillId: TRAIT.BIG_GAME_HUNTER,
        skillName: 'Big Game Hunter',
        name: 'Big Game Hunter \u2014 Vulnerability',
        priority: 5,
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Hunter's Determination's tuning and behavior at the existing Dragonhunter boundaries. */
export const huntersDetermination = defineTrait({
  id: TRAIT.HUNTERS_DETERMINATION,
  name: "Hunter's Determination",
  balance: { resourceGain: 100 }
});

/** Owns Hunter's Premonition's tuning and behavior at the existing Dragonhunter boundaries. */
export const huntersPremonition = defineTrait({
  id: TRAIT.HUNTERS_PREMONITION,
  name: "Hunter's Premonition",
  balance: {
    effects: [{ type: 'boon', name: 'aegis', boon: 'aegis', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 0,
      emit: TRAIT.HUNTERS_PREMONITION,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Trap')),
      effects: (effect) => effect.type === 'boon' && effect.name === 'aegis',
      attribution: (_runtime, cast) => ({
        source: 'guardian',
        sourceId: cast.skill.id,
        actorType: 'player',
        name: undefined
      })
    }
  ]
});

/** Owns Dulled Senses's tuning and behavior at the existing Dragonhunter boundaries. */
export const dulledSenses = defineTrait({
  id: TRAIT.DULLED_SENSES,
  name: 'Dulled Senses',
  balance: {
    effects: [
      {
        type: 'condition',
        name: 'Crippled',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  }
});

/** Owns Defender's Dogma's tuning and behavior at the existing Dragonhunter boundaries. */
export const defendersDogma = defineTrait({
  id: TRAIT.DEFENDERS_DOGMA,
  name: "Defender's Dogma",
  balance: { attributeBonus: 180 },
  buildAttributes: (_common, { balanceContext }) => {
    const defendersDogmaProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.DEFENDERS_DOGMA);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: "Defender's Dogma",
          to: 'Vitality',
          amount: balanceProfileNumber(defendersDogmaProfile, 'attributeBonus'),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Heavy Light's tuning and behavior at the existing Dragonhunter boundaries. */
export const heavyLight = defineTrait({
  id: TRAIT.HEAVY_LIGHT,
  name: 'Heavy Light',
  balance: {
    internalCooldown: 1,
    effects: [{ type: 'boon', name: 'stability', boon: 'stability', stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      id: 'guardian.dragonhunter.heavy-light',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      order: 100,
      when: (context) => Boolean(context.config?.target?.defiant)
    }
  ]
});

/** Owns Pure of Sight's tuning and behavior at the existing Dragonhunter boundaries. */
export const pureOfSight = defineTrait({
  id: TRAIT.PURE_OF_SIGHT,
  name: 'Pure of Sight',
  modifierRules: [
    {
      id: 'guardian.dragonhunter.pure-of-sight',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      order: 100
    }
  ]
});

/** Owns Zealot's Aggression's tuning and behavior at the existing Dragonhunter boundaries. */
export const zealotsAggression = defineTrait({
  id: TRAIT.ZEALOTS_AGGRESSION,
  name: "Zealot's Aggression",
  modifierRules: [
    {
      id: 'guardian.dragonhunter.zealots-aggression',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      order: 100,
      when: (context) => targetConditionActive(context, 'Crippled')
    }
  ]
});

export const dragonhunterTraits = [
  pureOfSight,
  zealotsAggression,
  heavyLight,
  bigGameHunter,
  soaringDevastation,
  huntersDetermination,
  huntersPremonition,
  dulledSenses,
  defendersDogma
];
