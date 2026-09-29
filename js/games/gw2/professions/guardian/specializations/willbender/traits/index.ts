import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { lethalTempoStacks } from '#gw2/professions/guardian/specializations/willbender/traits/behavior.js';

/** Intrinsic virtue grants share an inclusive stack lifetime and the outgoing additive damage bucket. */
export const lethalTempo = defineTrait({
  id: TRAIT.LETHAL_TEMPO,
  name: 'Lethal Tempo',
  balance: {
    maximumStacks: 5,
    effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      requiresSelection: false,
      id: 'guardian.willbender.lethal-tempo-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // Lethal Tempo shares the outgoing additive bucket with equipment and other additive traits.
      operation: 'damage-additive',
      // Tyrant's Momentum raises strike bonus (5 % vs 2 %) to compensate for the shorter window.
      parameters: {
        damagePerStack: 0.02,
        tyrantsMomentumDamagePerStack: 0.05
      },
      amount: (context, _target, parameters) =>
        lethalTempoStacks(context) *
        (hasTrait(context, TRAIT.TYRANTS_MOMENTUM)
          ? parameters.tyrantsMomentumDamagePerStack
          : parameters.damagePerStack),
      order: 100
    },
    {
      requiresSelection: false,
      id: 'guardian.willbender.lethal-tempo-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      // Use the same additive grouping for conditions so Bursting does not multiply Lethal Tempo.
      operation: 'damage-additive',
      // Condition bonus is identical (2 %) without Tyrant's Momentum; the trait adds 1 % here too.
      parameters: {
        damagePerStack: 0.02,
        tyrantsMomentumDamagePerStack: 0.03
      },
      amount: (context, _target, parameters) =>
        lethalTempoStacks(context) *
        (hasTrait(context, TRAIT.TYRANTS_MOMENTUM)
          ? parameters.tyrantsMomentumDamagePerStack
          : parameters.damagePerStack),
      order: 100
    }
  ]
});

/** Selects longer Justice and shorter Tempo windows while the shared stack rules retain live tuning. */
export const tyrantsMomentum = defineTrait({
  id: TRAIT.TYRANTS_MOMENTUM,
  name: "Tyrant's Momentum",
  balance: {
    effects: [
      { type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', stacks: 1, duration: 4 },
      { type: 'buff', name: 'justice', kind: 'justice', stacks: 1, duration: 10 }
    ]
  }
});

/** Tracks reserved weapon work so earned reductions survive to commitment without moving their origin. */
export const restorativeVirtues = defineTrait({
  id: TRAIT.RESTORATIVE_VIRTUES,
  name: 'Restorative Virtues',
  balance: {
    // Each virtue trigger advances active weapon recharge by 280ms before recharge-speed conversion.
    rechargeReduction: 0.28,
    effects: [{ type: 'boon', name: 'vigor', boon: 'vigor', stacks: 1, duration: 3 }]
  },
  hooks: {
    onCastStart(runtime, cast) {
      if (cast.cancelled) return;
      if (cast.skill.type === 'Weapon')
        willbenderState.from(runtime).weaponCastRecharge[cast.id] = {
          skillId: cast.skill.id,
          rechargeStart: cast.rechargeStart,
          rechargeWork: cast.rechargeWork
        };
    },
    onCastCommit(runtime, cast) {
      const state = willbenderState.from(runtime);
      const pending = state.pendingWeaponCooldownReduction[cast.id] ?? 0;
      delete state.pendingWeaponCooldownReduction[cast.id];
      delete state.weaponCastRecharge[cast.id];
      if (pending > 0) runtime.cooldownController.reduceSkillRecharge(cast.skill, pending, runtime.time);
    }
  }
});

/** Virtue activation grants Fury and accepted hit cycles grant party Might. */
export const holyReckoning = defineTrait({
  id: TRAIT.HOLY_RECKONING,
  name: 'Holy Reckoning',
  balance: {
    effects: [
      { type: 'boon', name: 'might', boon: 'might', stacks: 1, duration: 15, audience: { recipients: 'party' } },
      { type: 'boon', name: 'fury', boon: 'fury', stacks: 1, duration: 3, audience: { recipients: 'self' } }
    ]
  }
});

/** Resolve activation and completed cycles grant distinct Alacrity packets with selected Battle Presence sharing. */
export const phoenixProtocol = defineTrait({
  id: TRAIT.PHOENIX_PROTOCOL,
  name: 'Phoenix Protocol',
  balance: {
    effects: [
      { type: 'boon', name: 'alacrity', boon: 'alacrity', stacks: 1, duration: 5 },
      {
        type: 'boon',
        name: 'alacrity (triggered)',
        boon: 'alacrity',
        stacks: 1,
        duration: 1,
        packetLabel: 'triggered'
      }
    ]
  }
});

/** Only tagged flame strikes receive the multiplier; the panel bonus remains eligible for conversions. */
export const powerForPower = defineTrait({
  id: TRAIT.POWER_FOR_POWER,
  name: 'Power for Power',
  balance: { attributeBonus: 120 },
  modifierRules: [
    {
      id: 'guardian.willbender.power-for-power',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 3,
      order: 100,
      // willbenderFlames flag is set only on Willbender Flames pulse strikes emitted by hooks.ts,
      // so this 3× multiplier never applies to normal weapon hits.
      when: (context) => Boolean(context.event?.willbenderFlames)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        source: 'Power for Power',
        to: 'Power',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.POWER_FOR_POWER),
          'attributeBonus'
        ),
        feedsConversions: true
      }
    ]
  })
});

/** Supplies the panel Vitality bonus before eligible conversions. */
export const conceitedCurate = defineTrait({
  id: TRAIT.CONCEITED_CURATE,
  name: 'Conceited Curate',
  balance: { attributeBonus: 180 },
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        source: 'Conceited Curate',
        to: 'Vitality',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.CONCEITED_CURATE),
          'attributeBonus'
        ),
        feedsConversions: true
      }
    ]
  })
});

/** Accepted flame strikes emit the surviving Burning packet independently of virtue counters. */
export const searingPact = defineTrait({
  id: TRAIT.SEARING_PACT,
  name: 'Searing Pact',
  balance: {
    attributeBonus: 120,
    effects: [{ type: 'condition', name: 'Burning', condition: 'Burning', stacks: 1, duration: 1 }]
  },
  triggers: [
    {
      emit: TRAIT.SEARING_PACT,
      on: 'damage.resolved',
      when: (_runtime, event, details) =>
        Boolean(event.willbenderFlames) &&
        (details.hitContext?.damage ?? 0) > 0 &&
        Number(event.coefficient) > 0 &&
        (event.actorType === 'player' || event.sourceId === 'sigil.air'),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Burning',
      attribution: {
        source: 'guardian',
        actorType: 'player',
        skillId: TRAIT.SEARING_PACT,
        skillName: 'Searing Pact',
        name: 'Searing Pact \u2014 Burning',
        triggeredBy: 'Willbender Flames'
      }
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        source: 'Searing Pact',
        to: 'Condition Damage',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.SEARING_PACT),
          'attributeBonus'
        ),
        feedsConversions: true
      }
    ]
  })
});

export const willbenderTraits = [
  lethalTempo,
  tyrantsMomentum,
  restorativeVirtues,
  holyReckoning,
  phoenixProtocol,
  powerForPower,
  conceitedCurate,
  searingPact
];
