/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, CONDITION, CONTROL, STATUS, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// EVTC-measured Quickness timings keep spear casts aligned with their observed cast-lane occupancy.
// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ThiefSkill>>> = {
  [ID.ASHEN_ASSAULT]: {
    name: 'Ashen Assault',
    icon: 'https://render.guildwars2.com/file/07F4055E57F1E82EE1BFBAA11AE1F59145070617/3379197.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    initiativeRefund: 4,
    preservesStealth: true,
    spearStealthAttack: true,
    cooldown: 0,
    requiredMainHand: WEAPON.SPEAR,
    stealthAttack: true,
    castTimeMs: 1200,
    // Cancelling keeps earlier packets and removes the remainder of the channel.
    interruptMode: 'per-packet',
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
    // The chain resets on completion; the channel's landed-hit observer owns the all-strikes initiative refund.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }]
  },
  [ID.BARBED_SPEAR]: {
    name: 'Barbed Spear',
    icon: 'https://render.guildwars2.com/file/3A5C3F7697DAE8C90B450B92323937A396EDC4EC/3379188.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    // Preserve the measured repeat cadence for the spear autoattack.
    castTimeMs: 560,
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
  },
  [ID.MANTIS_STING]: {
    name: 'Mantis Sting',
    icon: 'https://render.guildwars2.com/file/195C9FD6753501224702FE4EA7480E2CD7437B29/3379189.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    weaponBarChainRootId: 73041,
    weaponBarChainStep: 1,
    cost: { resource: 'initiative', amount: 3 },

    cooldown: 0,
    castTimeMs: 400,
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
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }]
  },
  [ID.ENTANGLING_ASP]: {
    name: 'Entangling Asp',
    icon: 'https://render.guildwars2.com/file/0A5EE17BC8F00A9F10349C72C4D5B7366C37FF04/3379190.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    weaponBarChainRootId: 73041,
    weaponBarChainStep: 2,
    cost: { resource: 'initiative', amount: 2 },

    cooldown: 0,
    castTimeMs: 520,
    // The attack launches before impact; a queued finisher must retain the launched strike and chain advancement.
    interruptCommitMs: 360,
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
    ),
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }]
  },
  [ID.FALLING_SPIDER]: {
    name: 'Falling Spider',
    icon: 'https://render.guildwars2.com/file/BEA5D1B8D1BC0F97690CE57CD03DADB9DA7F4004/3379191.png',
    cost: { resource: 'initiative', amount: 1 },

    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Spear',
    weaponBarChainRootId: 73041,
    weaponBarChainStep: 3,
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    empoweredDamageMultiplier: 1.15,
    empoweredConditionStacks: 1,
    cooldown: 0,
    castTimeMs: 600,
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
    ]),
    // Capture the qualifying predecessor at acceptance and transform the live base packets, including patched ticks.
    effectVariants: [
      {
        when: (runtime: MechanicQueriesOf<ThiefRuntime>) =>
          (runtime.profession.core.spearChainStage || 0) === 2 &&
          runtime.profession.core.spearPreviousSkillId === ID.ENTANGLING_ASP,
        transform: (runtime, cast) => {
          const profile = requireSkillFromContext(runtime, ID.FALLING_SPIDER);
          const factor = skillNumber(profile, 'empoweredDamageMultiplier');
          const extraStacks = skillNumber(profile, 'empoweredConditionStacks');
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
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }]
  },
  [ID.UNSUSPECTING_STRIKE]: {
    name: 'Unsuspecting Strike',
    icon: 'https://render.guildwars2.com/file/805A252809DD3DA83ECACC630803A21B904158AA/3379192.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    weaponBarChainRootId: 72986,
    weaponBarChainStep: 1,
    cost: { resource: 'initiative', amount: 3 },

    cooldown: 0,
    castTimeMs: 680,
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
            do: [{ type: 'thief.unsuspecting-bleeding' }]
          }
        ],
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }]
  },
  [ID.VAMPIRIC_SLASH]: {
    name: 'Vampiric Slash',
    icon: 'https://render.guildwars2.com/file/60071334EC9B38397C03A5290B372D6FF3E831B0/3379193.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    weaponBarChainRootId: 72986,
    weaponBarChainStep: 2,
    cost: { resource: 'initiative', amount: 1 },

    cooldown: 0,
    // The measured follow-up includes its siphon animation before the next chain input.
    castTimeMs: 440,
    // The strike and siphon resolve before the final animation tail.
    interruptCommitMs: 400,
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
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }]
  },
  [ID.SHATTERING_ASSAULT]: {
    name: 'Shattering Assault',
    icon: 'https://render.guildwars2.com/file/68E71F96676504BED138AA0F3238D33B1408F3F9/3379194.png',
    cost: { resource: 'initiative', amount: 1 },

    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    weaponBarChainRootId: 72986,
    weaponBarChainStep: 3,
    cooldown: 0,
    castTimeMs: 640,
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
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.stealth' } },
      { on: 'castCommit', do: { type: 'thief.spear-chain' } }
    ]
  },
  [ID.DISTRACTING_THROW]: {
    name: 'Distracting Throw',
    icon: 'https://render.guildwars2.com/file/D778C3EF460E2F960DA2153F7A3326C13DAD18E7/3379195.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_4',
    cost: { resource: 'initiative', amount: 2 },

    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    duration: 10,
    cooldown: 0,
    castTimeMs: 360,
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
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }]
  },
  [ID.SHADOW_VEIL]: {
    name: 'Shadow Veil',
    icon: 'https://render.guildwars2.com/file/97B9B5EC330C0780DB7DE0AA0FE4B0713F3F92D2/3379196.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_5',
    cost: { resource: 'initiative', amount: 3 },

    cooldown: 0,
    // The defensive stance releases the input lane immediately after activation.
    castTimeMs: 80,
    effects: []
  }
};

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
