import { ACTOR, AURA, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import {
  balanceNumberFromContext,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  berserkEntered,
  berserkerCastCompleted
} from '#gw2/professions/warrior/specializations/berserker/mechanics/berserk.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import {
  DETONATE,
  active,
  armAura,
  detonate,
  isBerserkerSkill
} from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';
import type { WarriorRuntime, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Owns this trait's tuning and selected contributions. */
const burstOfAggression = defineTrait({
  triggers: [
    onTriggerPoint(berserkEntered, {
      requiresSelection: false,
      run: (runtime, input: TriggerPointInput<typeof berserkEntered>) =>
        emitBerserkEntryBoons(runtime, input.cast, TRAIT.BURST_OF_AGGRESSION)
    })
  ],
  id: TRAIT.BURST_OF_AGGRESSION,
  name: 'Burst of Aggression',
  balance: {
    effects: [
      { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 3 },
      { name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, stacks: 1, duration: 8 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
const bloodyRoar = defineTrait({
  triggers: [
    onTriggerPoint(berserkEntered, {
      run: (runtime, input: TriggerPointInput<typeof berserkEntered>) =>
        emitBerserkEntryBoons(runtime, input.cast, TRAIT.BLOODY_ROAR)
    })
  ],
  id: TRAIT.BLOODY_ROAR,
  name: 'Bloody Roar',
  balance: {
    damageMultiplier: 1.1,
    effects: [{ name: boonKey(BOON.RESISTANCE), type: 'boon', boon: BOON.RESISTANCE, stacks: 1, duration: 3.5 }]
  },
  modifierRules: [
    {
      id: 'warrior.bloody-roar',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.BLOODY_ROAR, 'damageMultiplier'),
      order: 100,
      when: (context) => active(context)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
const lastBlaze = defineTrait({
  id: TRAIT.LAST_BLAZE,
  name: 'Last Blaze',
  balance: {
    durationMultiplier: 1,
    effects: [{ name: CONDITION.BURNING, type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 4 }]
  },
  triggers: [
    {
      order: 0,
      on: 'castCommit',

      emit: TRAIT.LAST_BLAZE,
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Rage')),
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.BURNING,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.LAST_BLAZE,
        actorType: ACTOR.EFFECT,
        ownerActorType: ACTOR.PLAYER,
        name: 'Last Blaze — Burning'
      }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
const smashBrawler = defineTrait({
  id: TRAIT.SMASH_BRAWLER,
  name: 'Smash Brawler',
  balance: {
    criticalChance: 0.15,
    resourceGain: 2,
    minimumStacks: 1
  },
  modifierRules: [
    {
      order: 8,
      id: 'warrior.smash-brawler-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.SMASH_BRAWLER, 'criticalChance'),
      when: (context) => active(context)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
const heatTheSoul = defineTrait({
  triggers: [
    onTriggerPoint(berserkerCastCompleted, {
      run: (runtime, input: TriggerPointInput<typeof berserkerCastCompleted>) =>
        heatTheSoulCompletion(runtime, input.cast)
    })
  ],
  id: TRAIT.HEAT_THE_SOUL,
  name: 'Heat the Soul',
  balance: {
    effects: [
      { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 5 },
      { name: 'Decapitate quickness', type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 2 },
      { name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, stacks: 1, duration: 5 },
      { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 3, duration: 5 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
const kingOfFires = defineTrait({
  triggers: [
    {
      on: 'damage.resolved',
      run(runtime, event, details) {
        if (event.actorType !== ACTOR.PLAYER || !(Number(event.coefficient) > 0)) return;

        const hit = details.hitContext as Gw2HitResolutionContext;
        const state = berserkerState.from(runtime);

        if (
          !hit.critEligible ||
          !hit.critical.didCrit ||
          !runtime.procs.claim(TRAIT.KING_OF_FIRES, 'warrior.berserker.kingOfFires', runtime.time)
        )
          return;

        const profile = requireBalanceProfileFromContext(runtime, TRAIT.KING_OF_FIRES);
        // The qualifying critical hit owns the interval even when its optional aura packet is removed.
        const aura = requireEffect(profile, 'buff', 'fire-aura');

        if (!aura) return;

        const duration = effectNumber(profile, aura, 'duration');
        armAura(runtime, gw2EffectExpiresAt(runtime.time, duration));
        emitTraitProfile(runtime, TRAIT.KING_OF_FIRES, TRAIT.KING_OF_FIRES, event, {
          at: runtime.time,
          fullEnd: runtime.time,
          effect: { type: 'buff', name: 'fire-aura' },
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.KING_OF_FIRES,
            actorType: ACTOR.EFFECT,
            skillId: event.skillId,
            skillName: event.skillName,
            name: 'King of Fires — Fire Aura'
          },
          transform: (packet) => ({ ...packet, duration: duration })
        });
        runtime.effects.emit({
          kind: 'announcement',
          announcement: {
            type: 'trait',
            name: AURA.FIRE,
            at: runtime.time,
            sourceSkill: event.skillName,
            detail: 'Granted by King of Fires',
            icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fire_Aura.png'
          }
        });

        if (event.activationId != null && state.completedActivations[event.activationId] != null)
          runtime.schedule(
            DETONATE,
            runtime.time,
            { activationId: event.activationId, skillId: event.skillId },
            undefined,
            5
          );
      }
    },
    onTriggerPoint(berserkerCastCompleted, {
      run: (runtime, input: TriggerPointInput<typeof berserkerCastCompleted>) =>
        kingOfFiresCompletion(runtime, input.cast)
    })
  ],
  id: TRAIT.KING_OF_FIRES,
  name: 'King of Fires',
  balance: {
    durationMultiplier: 0.33,
    internalCooldown: 15,
    effects: [
      { name: 'fire-aura', type: 'buff', kind: 'fire-aura', stacks: 1, duration: 5 },
      { name: 'Strike', type: 'strike', coefficient: 0.7, hits: 1 },
      { name: CONDITION.BURNING, type: 'condition', condition: CONDITION.BURNING, stacks: 3, duration: 3 }
    ]
  },
  attributes(context) {
    return {
      traitDurations: {
        'Burning Duration':
          balanceNumberFromContext(context.balanceContext, TRAIT.KING_OF_FIRES, 'durationMultiplier') * 100
      }
    };
  },
  lifetime: {
    reactions: {
      'aura.applied'(runtime, event) {
        if (event.aura === AURA.FIRE) armAura(runtime, gw2EffectExpiresAt(runtime.time, event.duration ?? 0));
      }
    },
    tasks: {
      [DETONATE](runtime, payload) {
        detonate(runtime, payload as { activationId: string; skillId: number | string });
      }
    }
  }
});

/** Owns this trait's tuning and selected contributions. */
export const bloodReaction = defineTrait({
  // Ordinary eligible conversions exclude signets, utility conversions, Might, and Berserk's flat grants.
  attributes(context) {
    const factor = balanceNumberFromContext(
      context,
      TRAIT.BLOOD_REACTION,
      active(context) ? 'coefficientMultiplier' : 'attributeConversion'
    );
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Precision',
          to: 'Ferocity',
          multiplier: factor,
          rounding: 'round',
          input: 'eligible'
        },
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Condition Damage',
          multiplier: factor,
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  },
  id: TRAIT.BLOOD_REACTION,
  name: 'Blood Reaction',
  balance: {
    attributeConversion: 0.12,
    coefficientMultiplier: 0.24
  }
});

/** Native specialization prerequisite; intrinsic resource state remains shared with the mode owner. */
const primalRage = defineTrait({ id: TRAIT.PRIMAL_RAGE, name: 'Primal Rage' });

/** Native specialization prerequisite; intrinsic resource state remains shared with the mode owner. */
const fatalFrenzy = defineTrait({ id: TRAIT.FATAL_FRENZY, name: 'Fatal Frenzy' });

/** Register native owners once in declaration order. */
export const warriorBerserkerTraits = [
  fatalFrenzy,
  primalRage,
  burstOfAggression,
  bloodyRoar,
  lastBlaze,
  smashBrawler,
  heatTheSoul,
  kingOfFires,
  bloodReaction
] as const;

/** Entry traits share self-boon delivery while preserving their own selection rules, tuning, and cast attribution. */
function emitBerserkEntryBoons(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>, traitId: number): void {
  const profile = requireBalanceProfileFromContext(runtime, traitId);
  emitTraitProfile(runtime, traitId, traitId, undefined, {
    attribution: {
      source: 'Trait',
      sourceId: traitId,
      actorType: ACTOR.EFFECT,
      activationId: cast.id,
      skillId: cast.skill.id,
      skillName: cast.skill.name
    },
    transform: (event) => ({
      ...event,
      name: profile.name,
      duration: event.duration,
      audience: { recipients: RECIPIENT.SELF }
    }),
    effects: (effect) => effect.type === 'boon'
  });
}

/** Own this trait's reward at the accepted mechanic boundary. */
function heatTheSoulCompletion(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  if (cast.skill.primalBurst) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.HEAT_THE_SOUL);
    emitTraitProfile(runtime, TRAIT.HEAT_THE_SOUL, TRAIT.HEAT_THE_SOUL, undefined, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.HEAT_THE_SOUL,
        actorType: ACTOR.EFFECT,
        activationId: cast.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        audience: { recipients: RECIPIENT.PARTY }
      }),
      // Select exactly one Quickness variant before materialization so live boon duration applies once.
      effects: (effect) =>
        effect.type === 'boon' &&
        (effect.boon !== BOON.QUICKNESS ||
          effect.name === (cast.skill.id === ID.DECAPITATE ? 'Decapitate quickness' : boonKey(BOON.QUICKNESS)))
    });
  }
}

/** Own this trait's reward at the accepted mechanic boundary. */
function kingOfFiresCompletion(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  if (isBerserkerSkill(cast.skill)) {
    berserkerState.from(runtime).completedActivations[cast.id] = runtime.time;
    runtime.schedule(DETONATE, runtime.time, { activationId: cast.id, skillId: cast.skill.id }, undefined, 5);
  }
}
