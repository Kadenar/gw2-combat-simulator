import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { berserkerState } from '#gw2/professions/warrior/specializations/berserker/state.js';
import {
  DETONATE,
  active,
  armAura,
  detonate
} from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';

/** Owns this trait's tuning and selected contributions. */
export const burstOfAggression = defineTrait({
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
  id: TRAIT.BLOODY_ROAR,
  name: 'Bloody Roar',
  balance: {
    effects: [{ name: 'resistance', type: 'boon', boon: 'resistance', stacks: 1, duration: 3.5 }]
  },
  modifierRules: [
    {
      id: 'warrior.bloody-roar',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      order: 100,
      when: (context) => hasTrait(context, TRAIT.BLOODY_ROAR) && active(context)
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
      when: (context) => hasTrait(context, TRAIT.SMASH_BRAWLER) && active(context)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const heatTheSoul = defineTrait({
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
  hooks: {
    reactions: {
      'aura.applied'(runtime, event) {
        if (event.aura === 'Fire Aura') armAura(runtime, gw2EffectExpiresAt(runtime.time, event.duration ?? 0));
      },
      'damage.resolved'(runtime, event, details) {
        if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !hasTrait(runtime, TRAIT.KING_OF_FIRES))
          return;
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
        runtime.emitDerived(event, {
          type: 'buff',
          at: runtime.time,
          source: 'Trait',
          sourceId: TRAIT.KING_OF_FIRES,
          actorType: 'effect',
          skillId: event.skillId,
          skillName: event.skillName,
          name: 'King of Fires — Fire Aura',
          kind: 'fire-aura',
          stacks: effectNumber(profile, aura, 'stacks'),
          duration
        });
        runtime.recordProc(
          'trait',
          'Fire Aura',
          runtime.time,
          event.skillName,
          'Granted by King of Fires',
          'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Fire_Aura.png'
        );
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
