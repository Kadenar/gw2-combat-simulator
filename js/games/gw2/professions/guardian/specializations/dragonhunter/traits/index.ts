import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';

import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceNumberFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';

import { guardianTraitIcon } from '#gw2/professions/guardian/core/traits/metadata.js';
import {
  dragonhunterCastCompleted,
  dragonhunterControlAccepted,
  type DragonhunterCastCompletion,
  type DragonhunterControl
} from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/trigger-points.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';

/** Owns Soaring Devastation's tuning and behavior at the existing Dragonhunter boundaries. */
const soaringDevastation = defineTrait({
  name: 'Soaring Devastation',
  id: TRAIT.SOARING_DEVASTATION,
  balance: {
    effects: [
      { type: 'strike', name: 'Strike', coefficient: 1.5, hits: 1 },
      {
        type: 'condition',
        name: CONDITION.IMMOBILIZED,
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 3
      }
    ]
  }
});

/** Owns Big Game Hunter's tuning and behavior at the existing Dragonhunter boundaries. */
const bigGameHunter = defineTrait({
  name: 'Big Game Hunter',
  id: TRAIT.BIG_GAME_HUNTER,
  balance: {
    damageMultiplier: 1.25,
    pulseInterval: 12,
    effects: [
      {
        type: 'condition',
        name: CONDITION.VULNERABILITY,
        condition: CONDITION.VULNERABILITY,
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
      factor: (context) => balanceNumberFromContext(context, TRAIT.BIG_GAME_HUNTER, 'damageMultiplier'),
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
        event.actorType === ACTOR.PLAYER &&
        Number(event.coefficient) > 0 &&
        (details.hitContext?.damage ?? 0) > 0 &&
        dragonhunterState.from(runtime).tetherUntil > runtime.time,
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.VULNERABILITY,
      attribution: (_runtime, event) => ({
        source: 'guardian',
        actorType: ACTOR.EFFECT,
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
const huntersDetermination = defineTrait({
  name: "Hunter's Determination",
  id: TRAIT.HUNTERS_DETERMINATION,
  balance: { resourceGain: 100 },
  triggers: [
    onTriggerPoint(dragonhunterCastCompleted, {
      when: (_runtime, { cast }: DragonhunterCastCompletion) => cast.skill.slot === 'Elite',
      run: grantHuntersDetermination
    })
  ]
});

/** Owns Hunter's Premonition's tuning and behavior at the existing Dragonhunter boundaries. */
const huntersPremonition = defineTrait({
  name: "Hunter's Premonition",
  id: TRAIT.HUNTERS_PREMONITION,
  balance: {
    effects: [{ type: 'boon', name: boonKey(BOON.AEGIS), boon: BOON.AEGIS, stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 0,
      emit: TRAIT.HUNTERS_PREMONITION,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Trap')),
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.AEGIS),
      attribution: (_runtime, cast) => ({
        source: 'guardian',
        sourceId: cast.skill.id,
        actorType: ACTOR.PLAYER,
        name: undefined
      })
    }
  ]
});

/** Owns Dulled Senses's tuning and behavior at the existing Dragonhunter boundaries. */
const dulledSenses = defineTrait({
  name: 'Dulled Senses',
  id: TRAIT.DULLED_SENSES,
  balance: {
    effects: [
      {
        type: 'condition',
        name: CONDITION.CRIPPLED,
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ]
  },
  triggers: [onTriggerPoint(dragonhunterControlAccepted, { run: applyDulledSenses })]
});

/** Owns Defender's Dogma's tuning and behavior at the existing Dragonhunter boundaries. */
const defendersDogma = defineTrait({
  name: "Defender's Dogma",
  id: TRAIT.DEFENDERS_DOGMA,
  balance: { attributeBonuses: { vitality: 180 } },
  attributes: traitAttributeEffects(TRAIT.DEFENDERS_DOGMA, [{ kind: 'flat', to: 'Vitality', feedsConversions: 'all' }])
});

/** Owns Heavy Light's tuning and behavior at the existing Dragonhunter boundaries. */
const heavyLight = defineTrait({
  name: 'Heavy Light',
  id: TRAIT.HEAVY_LIGHT,
  balance: {
    damageMultiplier: 1.15,
    internalCooldown: 1,
    effects: [{ type: 'boon', name: boonKey(BOON.STABILITY), boon: BOON.STABILITY, stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      id: 'guardian.dragonhunter.heavy-light',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.HEAVY_LIGHT, 'damageMultiplier'),
      order: 100,
      when: (context) => Boolean(context.config?.target?.defiant)
    }
  ],
  triggers: [onTriggerPoint(dragonhunterControlAccepted, { run: grantHeavyLight })]
});

/** Owns Pure of Sight's tuning and behavior at the existing Dragonhunter boundaries. */
const pureOfSight = defineTrait({
  name: 'Pure of Sight',
  id: TRAIT.PURE_OF_SIGHT,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.07 },
  modifierRules: [
    {
      id: 'guardian.dragonhunter.pure-of-sight',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.PURE_OF_SIGHT, 'damageMultiplier'),
      order: 100
    }
  ]
});

/** Owns Zealot's Aggression's tuning and behavior at the existing Dragonhunter boundaries. */
const zealotsAggression = defineTrait({
  name: "Zealot's Aggression",
  id: TRAIT.ZEALOTS_AGGRESSION,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      id: 'guardian.dragonhunter.zealots-aggression',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.ZEALOTS_AGGRESSION, 'damageMultiplier'),
      order: 100,
      when: (context) => targetConditionActive(context, CONDITION.CRIPPLED)
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

/** The elite cast grants endurance after its accepted virtue activation rewards. */
function grantHuntersDetermination(runtime: GuardianRuntime, { cast }: DragonhunterCastCompletion): void {
  const amount = balanceNumberFromContext(runtime, TRAIT.HUNTERS_DETERMINATION, 'resourceGain');
  runtime.endurance.grant(amount);
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: "Hunter's Determination",
      at: runtime.time,
      sourceSkill: cast.skill.name,
      detail: `${amount} endurance`,
      icon: guardianTraitIcon(TRAIT.HUNTERS_DETERMINATION)
    }
  });
}

/** Control-triggered Crippled resolves immediately so its reactions share the originating control timestamp. */
function applyDulledSenses(runtime: GuardianRuntime, { cause: event }: DragonhunterControl): void {
  const dulledSensesProfile = requireBalanceProfileFromContext(runtime, TRAIT.DULLED_SENSES);
  const crippled = requireEffect(dulledSensesProfile, 'condition', CONDITION.CRIPPLED);

  if (!crippled) return;

  emitTraitProfile(runtime, TRAIT.DULLED_SENSES, TRAIT.DULLED_SENSES, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: CONDITION.CRIPPLED },
    settlement: 'reaction',
    attribution: {
      source: 'guardian',
      sourceId: TRAIT.DULLED_SENSES,
      activationId: event.activationId,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.DULLED_SENSES,
      skillName: 'Dulled Senses',
      name: 'Dulled Senses — Crippled'
    },
    transform: (packet) => ({ ...packet, causalOrder: event.causalOrder ?? event.eventOrder })
  });
}

/** Heavy Light's Stability keeps a 1-second internal cooldown that the game tooltip does not expose. */
function grantHeavyLight(runtime: GuardianRuntime, { cause: event }: DragonhunterControl): void {
  const heavyLightProfile = requireBalanceProfileFromContext(runtime, TRAIT.HEAVY_LIGHT);
  const stability = requireEffect(heavyLightProfile, 'boon', boonKey(BOON.STABILITY));

  // Removing Stability leaves Heavy Light's interval unclaimed.
  if (!stability || !runtime.procs.claim(TRAIT.HEAVY_LIGHT, 'guardian.dragonhunter.heavyLight', event.at)) return;

  emitTraitProfile(runtime, TRAIT.HEAVY_LIGHT, TRAIT.HEAVY_LIGHT, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'boon', name: boonKey(BOON.STABILITY) },
    durationContext: event,
    attribution: {
      priority: 5,
      source: 'guardian',
      sourceId: TRAIT.HEAVY_LIGHT,
      activationId: event.activationId,
      actorType: ACTOR.PLAYER,
      skillId: TRAIT.HEAVY_LIGHT,
      skillName: 'Heavy Light',
      name: 'Heavy Light'
    },
    transform: (packet) => ({ ...packet, causalOrder: event.causalOrder ?? event.eventOrder })
  });
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Heavy Light',
      at: event.at,
      sourceSkill: event.skillName,
      detail: BOON.STABILITY,
      icon: guardianTraitIcon(TRAIT.HEAVY_LIGHT)
    }
  });
}
