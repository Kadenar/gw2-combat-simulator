import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { RangerRuntimeState, RangerSkill, RangerResolverContext } from '#gw2/professions/ranger/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
import { grantSkillCharges } from '#gw2/professions/ranger/core/skills/charge-grants.js';
import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { targetHasCondition } from '#gw2/platform/combat/state/targets.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect,
  effectNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import {
  stalkersStrikeTargetImpaired,
  isPetStrike,
  petDerivedConditionMetadata
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CRIPPLING_TALON]: {
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.9,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ],
    castTimeMs: 360
  },
  [ID.STALKERS_STRIKE]: {
    // Double this strike against the supported impairments, evaluated at impact.
    modifiers: [
      {
        id: 'ranger.stalkers-strike-movement-impaired',
        label: "Stalker's Strike - impaired target",
        target: 'strikeDamage',
        operation: 'multiply',
        factor: (context) =>
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, PROFILE.stalkersStrikeImpaired),
            'damageMultiplier'
          ),
        when: (context) =>
          stalkersStrikeTargetImpaired((condition) =>
            targetHasCondition(context.config ?? {}, condition, context.time, context.runtime)
          )
      }
    ],
    evades: true,
    effects: [
      {
        type: 'strike',
        // The strike owns only its impaired-target bonus; the base poison remains independent.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'each',
            when: (runtime, { event }) =>
              Number(event.coefficient) > 0 &&
              event.source !== 'ranger-pet' &&
              stalkersStrikeTargetImpaired((condition) => runtime.combat.targetHasCondition(condition, event.at)),
            do: { type: 'ranger.stalkers-poison' }
          }
        ],
        coefficient: 0.6,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 8
      }
    ],
    // Movement impairment adds the remaining strike and Poison bonuses during resolution.
    castTimeMs: 760
  },
  [ID.LEADING_SWIPE]: {
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.42,
        hits: 1
      }
    ],
    castTimeMs: 320
  },
  [ID.SERPENT_STAB]: {
    castTimeMs: 280,
    interruptCommitMs: 200,
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.44,
        hits: 1
      }
    ])
  },
  [ID.DOUBLE_ARC]: {
    // Arm subsequent qualifying hits only on semantic commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.poisonous-strikes' } }],
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 2,
        atMs: 0
      }
    ],

    cooldown: 6,
    castTimeMs: 600
    // Double Arc arms the pet's next two attacks; the weapon hit does not poison directly.
  },
  [ID.DEADLY_DELIVERY]: {
    castTimeMs: 440,
    interruptCommitMs: 280,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1
      }
    ])
  },
  [ID.GROUNDWORK_GOUGE]: {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      }
    ],
    castTimeMs: 280
  },
  [ID.INSTINCTIVE_ENGAGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 8
      }
    ],

    cooldown: 12,
    castTimeMs: 840
  }
});

/** The owning skill supplies charge limits, lifetime, and the triggered condition packet. */
export const poisonousStrikesProfile = variant(PROFILE.poisonousStrikes, ID.DOUBLE_ARC, 'Poisonous Strikes', {
  playerStacks: 2,
  durationMultiplier: 7,
  effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', stacks: 1, duration: 6 }]
});

export function handleRangerPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  // Double Arc replaces the shared pet/merged-player grant instead of accumulating charges.
  state.poisonousStrikes = grantCharges(Math.max(0, Number(event.charges || 0)), event.at + (event.duration || 0));
}

export function triggerPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  // Pet and merged-player routes share one grant, including its inclusive final hit.
  expireCharges(state.poisonousStrikes, event.at, true);

  if (!isPetStrike(event) || !(Number(event.coefficient) > 0)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.poisonousStrikes);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  // The charges exist only to deliver poison, so a removed packet leaves them unspent.
  if (!poison || !consumeCharge(state.poisonousStrikes, event.at, 0, true)) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      ...petDerivedConditionMetadata(context, event),

      at: event.at,
      source: 'ranger-pet',
      sourceId: ID.DOUBLE_ARC,
      actorType: 'summon',
      skillId: ID.DOUBLE_ARC,
      skillName: 'Poisonous Strikes',
      name: 'Poisonous Strikes - Poisoned',
      condition: String(poison.condition),
      duration: effectNumber(profile, poison, 'duration'),
      stacks: effectNumber(profile, poison, 'stacks'),
      triggeredBy: event.skillName
    })
  });
}

/** Queue grants at the declared activation boundary so same-time hits retain their established order. */
export const poisonousStrikesLifecycle = {
  sideEffectHandlers: {
    'ranger.poisonous-strikes'(runtime, context) {
      if (context.kind === 'cast')
        grantSkillCharges(runtime, context.cast, 'ranger.poisonous-strikes', PROFILE.poisonousStrikes);
    }
  },
  eventHandlers: { 'ranger.poisonous-strikes': handleRangerPoisonousStrikes }
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
