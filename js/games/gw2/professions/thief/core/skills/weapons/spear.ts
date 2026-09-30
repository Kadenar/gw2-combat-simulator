import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// EVTC-measured Quickness timings keep spear casts aligned with their observed cast-lane occupancy.
// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ENTANGLING_ASP]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],

    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 2,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Entangling Asp',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ])
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
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'buff',
        kind: 'stealth',
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
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 3,
          duration: 6,
          actorType: 'player'
        }
      ]),
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ]
  },
  [ID.UNSUSPECTING_STRIKE]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],

    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 3,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Unsuspecting Strike',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        // Only the accepted base Bleeding can earn the high-health bonus application.
        reactions: [
          {
            on: 'condition.applied',
            actor: 'player',
            packets: 'each',
            when: (runtime) =>
              !(Number(runtime.config.target?.health) > 0) ||
              targetHealthLoss(runtime.config, runtime) / Number(runtime.config.target?.health) < 0.1,
            do: { type: 'thief.unsuspecting-bleeding' }
          }
        ],
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ])
  },
  [ID.SHADOW_VEIL]: {
    castTimeMs: 1360,
    cooldown: 0,
    initiativeCost: 3,
    effects: []
  },
  [ID.ASHEN_ASSAULT]: {
    // The stealth attack consumes at acceptance; its refund and chain reset commit once.
    sideEffects: [
      { on: 'castCommit', do: { type: 'thief.spear-chain' } },
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'initiative',
          amount: { profile: PROFILE.ashenAssaultRefund, field: 'resourceGain' }
        }
      }
    ],
    preservesStealth: true,
    spearStealthAttack: true,

    castTimeMs: 1200,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520, 680, 880].map((atMs) => ({
          atMs,
          coefficient: 1.5 / 5
        })),
        name: 'Ashen Assault',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.3,
          hits: 1,
          name: 'Ashen Assault — Final Strike',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 5,
          duration: 8,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 3,
          duration: 4,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Poisoned',
          stacks: 3,
          duration: 4,
          actorType: 'player'
        }
      ])
    ],
    requiredMainHand: 'Spear',
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
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ])
  },
  [ID.VAMPIRIC_SLASH]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.spear-chain' } }],

    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Vampiric Slash — Packet 1',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
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
          actorType: 'player',
          canCrit: false
        },
        {
          type: 'condition',
          condition: 'Weakness',
          stacks: 1,
          duration: 3,
          actorType: 'player'
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
        when: (runtime: ThiefRuntime) =>
          (runtime.profession.core.spearChainStage || 0) === 2 &&
          runtime.profession.core.spearPreviousSkillId === ID.ENTANGLING_ASP,
        profileId: PROFILE.fallingSpiderEmpowered,
        transform: (runtime, cast) => {
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.fallingSpiderEmpowered);
          const factor = balanceProfileNumber(profile, 'damageMultiplier');
          const extraStacks = balanceProfileNumber(profile, 'resourceGain');
          const boosted = (condition: unknown) => ['Bleeding', 'Poisoned'].includes(String(condition));
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
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 3.5,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 4,
        duration: 8,
        actorType: 'player'
      }
    ])
  },
  [ID.BARBED_SPEAR]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.

    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.375,
        hits: 1,
        name: 'Barbed Spear',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 2.25,
        actorType: 'player'
      }
    ])
  }
});
