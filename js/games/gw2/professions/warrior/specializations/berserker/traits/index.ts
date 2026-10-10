import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { berserkEntered, berserkerCastCompleted } from '#gw2/professions/warrior/specializations/berserker/hooks.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import {
  DETONATE,
  active,
  armAura,
  detonate,
  isBerserkerSkill
} from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Owns this trait's tuning and selected contributions. */
export const burstOfAggression = defineTrait({
  triggers: [
    onTriggerPoint(berserkEntered, {
      requiresSelection: false,
      run: (runtime, input: TriggerPointInput<typeof berserkEntered>) => burstOfAggressionEntry(runtime, input.cast)
    })
  ],
  id: TRAIT.BURST_OF_AGGRESSION,
  name: 'Burst of Aggression',
  balance: {
    effects: [
      { name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 3 },
      { name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 8 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const bloodyRoar = defineTrait({
  triggers: [
    onTriggerPoint(berserkEntered, {
      run: (runtime, input: TriggerPointInput<typeof berserkEntered>) => bloodyRoarEntry(runtime, input.cast)
    })
  ],
  id: TRAIT.BLOODY_ROAR,
  name: 'Bloody Roar',
  balance: {
    damageMultiplier: 1.1,
    effects: [{ name: 'resistance', type: 'boon', boon: 'resistance', stacks: 1, duration: 3.5 }]
  },
  modifierRules: [
    {
      id: 'warrior.bloody-roar',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BLOODY_ROAR), 'damageMultiplier'),
      order: 100,
      when: (context) => active(context)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const lastBlaze = defineTrait({
  id: TRAIT.LAST_BLAZE,
  name: 'Last Blaze',
  balance: {
    durationMultiplier: 1,
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 4 }]
  },
  triggers: [
    {
      order: 0,
      on: 'castCommit',

      emit: TRAIT.LAST_BLAZE,
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Rage')),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Burning',
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.LAST_BLAZE,
        actorType: 'effect',
        ownerActorType: 'player',
        name: 'Last Blaze — Burning'
      }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const smashBrawler = defineTrait({
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
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SMASH_BRAWLER), 'criticalChance'),
      when: (context) => active(context)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const heatTheSoul = defineTrait({
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
      { name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      { name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 5 },
      { name: 'might', type: 'boon', boon: 'might', stacks: 3, duration: 5 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const kingOfFires = defineTrait({
  triggers: [
    {
      on: 'damage.resolved',
      run(runtime, event, details) {
        if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
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
            actorType: 'effect',
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
            name: 'Fire Aura',
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
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 3, duration: 3 }
    ]
  },
  buildAttributes(_common, context) {
    return {
      traitDurations: {
        'Burning Duration':
          balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.KING_OF_FIRES),
            'durationMultiplier'
          ) * 100
      }
    };
  },
  lifetime: {
    reactions: {
      'aura.applied'(runtime, event) {
        if (event.aura === 'Fire Aura') armAura(runtime, gw2EffectExpiresAt(runtime.time, event.duration ?? 0));
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
  id: TRAIT.BLOOD_REACTION,
  name: 'Blood Reaction',
  balance: {
    attributeConversion: 0.12,
    coefficientMultiplier: 0.24
  }
});

/** Native specialization prerequisite; intrinsic resource state remains shared with the mode owner. */
export const primalRage = defineTrait({ id: TRAIT.PRIMAL_RAGE, name: 'Primal Rage' });

/** Native specialization prerequisite; intrinsic resource state remains shared with the mode owner. */
export const fatalFrenzy = defineTrait({ id: TRAIT.FATAL_FRENZY, name: 'Fatal Frenzy' });

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

/** Own this trait's reward at the accepted mechanic boundary. */
function burstOfAggressionEntry(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BURST_OF_AGGRESSION);
    emitTraitProfile(runtime, TRAIT.BURST_OF_AGGRESSION, TRAIT.BURST_OF_AGGRESSION, undefined, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BURST_OF_AGGRESSION,
        actorType: 'effect',
        activationId: cast.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        duration: event.duration,
        audience: { recipients: 'self' }
      }),
      effects: (effect) => effect.type === 'boon'
    });
  }
}

/** Own this trait's reward at the accepted mechanic boundary. */
function bloodyRoarEntry(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.BLOODY_ROAR);
    emitTraitProfile(runtime, TRAIT.BLOODY_ROAR, TRAIT.BLOODY_ROAR, undefined, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.BLOODY_ROAR,
        actorType: 'effect',
        activationId: cast.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        duration: event.duration,
        audience: { recipients: 'self' }
      }),
      effects: (effect) => effect.type === 'boon'
    });
  }
}

/** Own this trait's reward at the accepted mechanic boundary. */
function heatTheSoulCompletion(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  if (cast.skill.primalBurst) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.HEAT_THE_SOUL);
    emitTraitProfile(runtime, TRAIT.HEAT_THE_SOUL, TRAIT.HEAT_THE_SOUL, undefined, {
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.HEAT_THE_SOUL,
        actorType: 'effect',
        activationId: cast.id,
        skillId: cast.skill.id,
        skillName: cast.skill.name
      },
      transform: (event) => ({
        ...event,
        name: profile.name,
        duration:
          event.kind === 'quickness' && cast.skill.id === ID.DECAPITATE
            ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SMASH_BRAWLER), 'resourceGain')
            : event.duration,
        audience: { recipients: 'party' }
      }),
      effects: (effect) => effect.type === 'boon'
    });
  }
}

/** Own this trait's reward at the accepted mechanic boundary. */
function kingOfFiresCompletion(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  if (isBerserkerSkill(cast.skill)) {
    berserkerState.from(runtime).completedActivations[cast.id] = runtime.time;
    runtime.schedule(DETONATE, runtime.time, { activationId: cast.id, skillId: cast.skill.id }, undefined, 5);
  }
}

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
