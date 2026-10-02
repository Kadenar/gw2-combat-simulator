import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2EventActorType, isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { timedActive } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { observeChronomancerEvent } from '#gw2/professions/mesmer/specializations/chronomancer/traits/behavior.js';
import { completeChronomancerTimeBomb } from '#gw2/professions/mesmer/specializations/chronomancer/traits/time-bomb.js';

/** Danger Time retains its active profile, selection, and original execution boundary. */
export const dangerTime = defineTrait<MesmerSkill>({
  id: TRAIT.DANGER_TIME,
  name: 'Danger Time',
  balance: {
    criticalDamage: 0.05,
    durationMultiplier: 10
  },
  modifierRules: [
    {
      id: 'mesmer.danger-time',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        1 + balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DANGER_TIME), 'criticalDamage'),
      when: (context) =>
        ['player', 'summon'].includes(gw2EventActorType(context.event)) && timedActive(context, 'danger-time')
    }
  ],
  hooks: { reactions: { 'control.resolved': observeChronomancerEvent } }
});

/** Delayed Reactions retains its active profile, selection, and original execution boundary. */
export const delayedReactions = defineTrait<MesmerSkill>({ id: TRAIT.DELAYED_REACTIONS, name: 'Delayed Reactions' });

/** Flow of Time retains its active profile, selection, and original execution boundary. */
export const flowOfTime = defineTrait<MesmerSkill>({
  id: TRAIT.FLOW_OF_TIME,
  name: 'Flow of Time',
  balance: {
    criticalChance: 0.15
  },
  modifierRules: [
    {
      id: 'mesmer.flow-of-time-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLOW_OF_TIME), 'criticalChance'),
      when: (context) =>
        Boolean(context.config?.boons?.alacrity) && ['player', 'summon'].includes(gw2EventActorType(context.event))
    }
  ],
  buildAttributes: (_common, { balanceContext, build }) => ({
    traitCriticalChance:
      build.assumptions?.alacrity !== false
        ? 100 *
          balanceProfileNumber(requireBalanceProfileFromContext(balanceContext, TRAIT.FLOW_OF_TIME), 'criticalChance')
        : 0
  })
});

/** Chronophantasma retains its active profile, selection, and original execution boundary. */
export const chronophantasma = defineTrait<MesmerSkill>({
  id: TRAIT.CHRONOPHANTASMA,
  name: 'Chronophantasma',
  balance: {
    damageMultiplier: 1.05
  }
});

/** Time Catches Up retains its active profile, selection, and original execution boundary. */
export const timeCatchesUp = defineTrait<MesmerSkill>({
  id: TRAIT.TIME_CATCHES_UP,
  name: 'Time Catches Up',
  modifierRules: [
    {
      id: 'mesmer.time-catches-up',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      order: 100,
      // Time Catches Up affects only first-strike shatter packets against a movement-impaired target.
      when: (context) =>
        Boolean(context.event?.metadata?.shatterTraitEligible) &&
        ['Chilled', 'Crippled', 'Immobilized', 'Slow'].some((condition) => targetConditionActive(context, condition))
    }
  ]
});

/** Illusionary Reversion retains its active profile, selection, and original execution boundary. */
export const illusionaryReversion = defineTrait<MesmerSkill>({
  id: TRAIT.ILLUSIONARY_REVERSION,
  name: 'Illusionary Reversion',
  balance: {
    threshold: 3,
    resourceGain: 1
  }
});

/** Stretched Time retains its active profile, selection, and original execution boundary. */
export const stretchedTime = defineTrait<MesmerSkill>({
  id: TRAIT.STRETCHED_TIME,
  name: 'Stretched Time',
  balance: {
    durationPerTier: 1,
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        duration: 3,
        stacks: 1,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  }
});

/** Seize the Moment retains its active profile, selection, and original execution boundary. */
export const seizeTheMoment = defineTrait<MesmerSkill>({
  id: TRAIT.SEIZE_THE_MOMENT,
  name: 'Seize the Moment',
  balance: {
    durationPerTier: 1,
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  }
});

/** Time Bomb retains its active profile, selection, and original execution boundary. */
export const timeBomb = defineTrait<MesmerSkill>({
  id: TRAIT.TIME_BOMB,
  name: 'Time Bomb',
  balance: {
    durationMultiplier: 5,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 3, hits: 1 }]
  },
  modifierRules: [
    {
      id: 'mesmer.time-bomb',
      requiresSelection: false,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      // Preserve Time Catches Up before the applied Time Bomb multiplier.
      order: 101,
      when: (context) => isGw2PlayerActorEvent(context.event) && timedActive(context, 'time-bomb')
    }
  ],
  hooks: { onCastCommit: completeChronomancerTimeBomb }
});

/** Collect Chronomancer owners without moving shared Continuum or illusion state. */
export const chronomancerTraits = [
  flowOfTime,
  dangerTime,
  timeBomb,
  illusionaryReversion,
  stretchedTime,
  seizeTheMoment,
  chronophantasma,
  timeCatchesUp,
  delayedReactions
];
