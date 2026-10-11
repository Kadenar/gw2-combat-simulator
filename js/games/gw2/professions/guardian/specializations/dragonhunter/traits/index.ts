import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
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
} from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/activations.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

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
    damageMultiplier: 1.25,
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
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BIG_GAME_HUNTER), 'damageMultiplier'),
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
  balance: { resourceGain: 100 },
  triggers: [
    onTriggerPoint(dragonhunterCastCompleted, {
      when: (_runtime, { cast }: DragonhunterCastCompletion) => cast.skill.slot === 'Elite',
      run: grantHuntersDetermination
    })
  ]
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
  },
  triggers: [onTriggerPoint(dragonhunterControlAccepted, { run: applyDulledSenses })]
});

/** Owns Defender's Dogma's tuning and behavior at the existing Dragonhunter boundaries. */
export const defendersDogma = defineTrait({
  id: TRAIT.DEFENDERS_DOGMA,
  name: "Defender's Dogma",
  balance: { attributeBonus: 180 },
  attributes: traitAttributeEffects(TRAIT.DEFENDERS_DOGMA, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Heavy Light's tuning and behavior at the existing Dragonhunter boundaries. */
export const heavyLight = defineTrait({
  id: TRAIT.HEAVY_LIGHT,
  name: 'Heavy Light',
  balance: {
    damageMultiplier: 1.15,
    internalCooldown: 1,
    effects: [{ type: 'boon', name: 'stability', boon: 'stability', stacks: 1, duration: 6 }]
  },
  triggers: [onTriggerPoint(dragonhunterControlAccepted, { run: grantHeavyLight })],
  modifierRules: [
    {
      id: 'guardian.dragonhunter.heavy-light',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HEAVY_LIGHT), 'damageMultiplier'),
      order: 100,
      when: (context) => Boolean(context.config?.target?.defiant)
    }
  ]
});

/** Owns Pure of Sight's tuning and behavior at the existing Dragonhunter boundaries. */
export const pureOfSight = defineTrait({
  id: TRAIT.PURE_OF_SIGHT,
  name: 'Pure of Sight',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.07 },
  modifierRules: [
    {
      id: 'guardian.dragonhunter.pure-of-sight',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PURE_OF_SIGHT), 'damageMultiplier'),
      order: 100
    }
  ]
});

/** Owns Zealot's Aggression's tuning and behavior at the existing Dragonhunter boundaries. */
export const zealotsAggression = defineTrait({
  id: TRAIT.ZEALOTS_AGGRESSION,
  name: "Zealot's Aggression",
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      id: 'guardian.dragonhunter.zealots-aggression',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ZEALOTS_AGGRESSION), 'damageMultiplier'),
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

/** The elite cast grants endurance after its accepted virtue activation rewards. */
function grantHuntersDetermination(runtime: Runtime, { cast }: DragonhunterCastCompletion): void {
  const amount = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.HUNTERS_DETERMINATION),
    'resourceGain'
  );
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
function applyDulledSenses(runtime: Runtime, { cause: event }: DragonhunterControl): void {
  const dulledSensesProfile = requireBalanceProfileFromContext(runtime, TRAIT.DULLED_SENSES);
  const crippled = requireEffect(dulledSensesProfile, 'condition', 'Crippled');
  if (!crippled) return;
  emitTraitProfile(runtime, TRAIT.DULLED_SENSES, TRAIT.DULLED_SENSES, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: 'Crippled' },
    settlement: 'reaction',
    attribution: {
      source: 'guardian',
      sourceId: TRAIT.DULLED_SENSES,
      activationId: event.activationId,
      actorType: 'effect',
      skillId: TRAIT.DULLED_SENSES,
      skillName: 'Dulled Senses',
      name: 'Dulled Senses — Crippled'
    },
    transform: (packet) => ({ ...packet, causalOrder: event.causalOrder ?? event.eventOrder })
  });
}

/** Heavy Light's Stability keeps a 1-second internal cooldown that the game tooltip does not expose. */
function grantHeavyLight(runtime: Runtime, { cause: event }: DragonhunterControl): void {
  const heavyLightProfile = requireBalanceProfileFromContext(runtime, TRAIT.HEAVY_LIGHT);
  const stability = requireEffect(heavyLightProfile, 'boon', 'stability');
  // Removing Stability leaves Heavy Light's interval unclaimed.
  if (!stability || !runtime.procs.claim(TRAIT.HEAVY_LIGHT, 'guardian.dragonhunter.heavyLight', event.at)) return;
  emitTraitProfile(runtime, TRAIT.HEAVY_LIGHT, TRAIT.HEAVY_LIGHT, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'boon', name: 'stability' },
    durationContext: event,
    attribution: {
      priority: 5,
      source: 'guardian',
      sourceId: TRAIT.HEAVY_LIGHT,
      activationId: event.activationId,
      actorType: 'player',
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
      detail: 'Stability',
      icon: guardianTraitIcon(TRAIT.HEAVY_LIGHT)
    }
  });
}
