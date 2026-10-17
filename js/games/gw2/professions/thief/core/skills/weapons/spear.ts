import { ACTOR, STATUS, CONTROL, WEAPON, CONDITION } from '#gw2/platform/constants.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// EVTC-measured Quickness timings keep spear casts aligned with their observed cast-lane occupancy.
// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ENTANGLING_ASP]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],

    castTimeMs: 520,
    // The attack launches before impact; a queued finisher must retain the launched strike and chain advancement.
    interruptCommitMs: 360,
    cooldown: 0,
    initiativeCost: 2,
    effects: impactEffects(
      { atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 1.2,
          hits: 1,
          name: 'Entangling Asp',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 2,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.IMMOBILIZED,
          stacks: 1,
          duration: 2,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.SHATTERING_ASSAULT]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.spear-chain' } }
    ],

    castTimeMs: 640,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.8 }],
        name: 'Shattering Assault',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DISTRACTING_THROW]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],

    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.5,
          hits: 1,
          name: 'Distracting Throw',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.VULNERABILITY,
          stacks: 3,
          duration: 6,
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ]
  },
  [ID.UNSUSPECTING_STRIKE]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],
    castTimeMs: 680,
    cooldown: 0,
    initiativeCost: 3,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Unsuspecting Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        // Only the accepted base Bleeding can earn the high-health bonus application.
        reactions: [
          {
            on: 'condition.applied',
            actor: ACTOR.PLAYER,
            packets: 'each',
            // Both fixed preview health and simulated health use the same strict upper-health gate.
            when: (runtime) => (runtime.combat.remainingTargetHealthFraction() ?? 1) > 0.9,
            do: { type: 'thief.unsuspecting-bleeding' }
          }
        ],
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SHADOW_VEIL]: {
    // The defensive stance releases the input lane immediately after activation.
    castTimeMs: 80,
    cooldown: 0,
    initiativeCost: 3,
    effects: []
  },
  [ID.ASHEN_ASSAULT]: {
    // The chain resets on completion; the channel's landed-hit observer owns the all-strikes initiative refund.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],
    preservesStealth: true,
    spearStealthAttack: true,

    castTimeMs: 1200,
    // Cancelling keeps earlier packets and removes the remainder of the channel.
    interruptMode: 'per-packet',
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [320, 480, 560, 640, 760].map((atMs) => ({
          atMs,
          coefficient: 1.5 / 5
        })),
        name: 'Ashen Assault',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 1080, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.3,
          hits: 1,
          name: 'Ashen Assault — Final Strike',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.VULNERABILITY,
          stacks: 5,
          duration: 8,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 3,
          duration: 4,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.POISONED,
          stacks: 3,
          duration: 4,
          actorType: ACTOR.PLAYER
        }
      ])
    ],
    requiredMainHand: WEAPON.SPEAR,
    stealthAttack: true
  },
  [ID.MANTIS_STING]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],

    castTimeMs: 400,
    cooldown: 0,
    initiativeCost: 3,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mantis Sting',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.VAMPIRIC_SLASH]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],

    // The measured follow-up includes its siphon animation before the next chain input.
    castTimeMs: 440,
    // The strike and siphon resolve before the final animation tail.
    interruptCommitMs: 400,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1 }],
        name: 'Vampiric Slash — Packet 1',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          // The siphon owns a flat Power formula and a separate row from the weapon strike.
          coefficient: 0,
          flatStrikeBase: 1410,
          flatStrikePowerCoeff: 0.2,
          damageKind: 'life-steal',
          damageBreakdownName: 'Life Siphon - Vampiric Slash',
          hits: 1,
          name: 'Vampiric Slash — Life Siphon',
          // The vulnerability modifier targets this packet identity without depending on its display label.
          metadata: { packetKind: 'thief.vampiric-slash-life-siphon' },
          actorType: ACTOR.PLAYER,
          canCrit: false
        },
        {
          type: 'condition',
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ])
    ]
  },
  [ID.FALLING_SPIDER]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],
    // Capture the qualifying predecessor at acceptance and transform the live base packets, including patched ticks.
    effectVariants: [
      {
        when: (runtime: MechanicQueriesOf<ThiefRuntime>) =>
          (runtime.profession.core.spearChainStage || 0) === 2 &&
          runtime.profession.core.spearPreviousSkillId === ID.ENTANGLING_ASP,
        profileId: PROFILE.fallingSpiderEmpowered,
        transform: (runtime, cast) => {
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.fallingSpiderEmpowered);
          const factor = balanceProfileNumber(profile, 'damageMultiplier');
          const extraStacks = balanceProfileNumber(profile, 'resourceGain');
          const boosted = (condition: unknown) =>
            [CONDITION.BLEEDING, CONDITION.POISONED].some((name) => name === String(condition));
          return (cast.skill.effects ?? []).map((effect) => {
            if (effect.type === 'strike')
              return effect.ticks?.length
                ? {
                    ...effect,
                    ticks: effect.ticks.map((tick) => ({ ...tick, coefficient: tick.coefficient * factor }))
                  }
                : { ...effect, coefficient: (effect.coefficient || 0) * factor };

            if (effect.type !== 'condition') return effect;

            if (effect.ticks?.length)
              return {
                ...effect,
                ticks: effect.ticks.map((tick) =>
                  boosted(tick.condition) ? { ...tick, stacks: tick.stacks + extraStacks } : tick
                )
              };

            return boosted(effect.condition) ? { ...effect, stacks: (effect.stacks ?? 1) + extraStacks } : effect;
          });
        }
      }
    ],

    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 1,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Falling Spider',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 3.5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 3.5,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 4,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.BARBED_SPEAR]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.

    // Preserve the measured repeat cadence for the spear autoattack.
    castTimeMs: 560,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Barbed Spear',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 2.25,
        actorType: ACTOR.PLAYER
      }
    ])
  }
});

/** The spear finisher grants a timed damage bonus to player-owned packets. */
export const distractingThrowModifiers = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    order: 9,
    id: 'thief.distracting-throw-finisher',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && buffActive(context, 'distracting-throw')
  }
]);
