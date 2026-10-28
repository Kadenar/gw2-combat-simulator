import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT, STATUS } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';

// The prepared field's five packets begin after the activation-to-damage delay observed in EVTC.
const THOUSAND_NEEDLES_INITIAL_DELAY_MS = 280;
const PITFALL_PULSE_OFFSETS_MS = [1000, 2000, 3000];

// Signets announce their completed activation at cast end, so trait rewards never follow an interrupted cast.
const SIGNET_COMPLETED: NonNullable<Skill['sideEffects']> = [
  { on: 'castCommit', do: { type: 'thief.signet-completed' } }
];

// EVTC-measured Quickness timings keep utility casts aligned with their observed cast-lane occupancy.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WITHDRAW]: {
    cooldown: 18,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.PREPARE_THOUSAND_NEEDLES]: {
    cooldown: 30,
    rechargeAnchor: 'castStart',
    initiativeCost: 0,
    duration: 3,

    castTimeMs: 600,
    // Placement survives cancellation once the preparation commits.
    interruptCommitMs: 400,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.prepare-trap' } }]
  },
  [ID.HIDE_IN_SHADOWS]: {
    cooldown: 25,
    initiativeCost: 0,
    // The heal occupies its full recorded animation before granting stealth.
    castTimeMs: 920,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 6,
        stacks: 1
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }]
  },
  [ID.CALTROPS]: {
    cooldown: 24,
    initiativeCost: 0,
    castTimeMs: 920,
    // Once placed, the field keeps pulsing after the cast is interrupted.
    interruptCommitMs: 800,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'condition',
        // Apply one bleed on placement, then ten more at one-second intervals.
        ticks: Array.from({ length: 11 }, (_, index) => ({
          atMs: index * 1000,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 10
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: index * 1000,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.SPIDER_VENOM]: {
    cooldown: 30,
    initiativeCost: 0,

    castTimeMs: 0,
    effects: [
      {
        type: 'buff',
        name: 'spider-venom',
        kind: 'spider-venom',
        duration: 24,
        stacks: 6,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'thief.activate-venom',
          id: 'venom',
          effects: [
            { type: 'condition', name: CONDITION.POISONED, condition: CONDITION.POISONED, stacks: 1, duration: 3 }
          ]
        }
      }
    ]
  },
  [ID.BLINDING_POWDER]: {
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }]
  },
  [ID.ASSASSINS_SIGNET]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    attributeBonuses: { power: 180 },
    activePowerBonus: 540,
    duration: 5,

    cooldown: 20,
    initiativeCost: 0,

    castTimeMs: 0,
    effects: [],
    // Activate only after recharge settlement.
    sideEffects: [...SIGNET_COMPLETED, { on: 'castCommit', do: { type: 'thief.assassins-signet' } }]
  },
  [ID.SIGNET_OF_MALICE]: {
    cooldown: 12,
    initiativeCost: 0,
    castTimeMs: 200,
    effects: [],
    sideEffects: SIGNET_COMPLETED
  },
  [ID.SKALE_VENOM]: {
    cooldown: 30,
    initiativeCost: 0,

    castTimeMs: 0,
    effects: [
      {
        type: 'buff',
        name: 'skale-venom',
        kind: 'skale-venom',
        duration: 24,
        stacks: 4,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'thief.activate-venom',
          id: 'venom',
          effects: [
            {
              type: 'condition',
              name: CONDITION.VULNERABILITY,
              condition: CONDITION.VULNERABILITY,
              stacks: 1,
              duration: 10
            },
            { type: 'condition', name: CONDITION.TORMENT, condition: CONDITION.TORMENT, stacks: 1, duration: 3 }
          ]
        }
      }
    ]
  },
  [ID.PREPARE_PITFALL]: {
    cooldown: 25,
    rechargeAnchor: 'castStart',
    initiativeCost: 0,
    duration: 3,

    castTimeMs: 360,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.prepare-trap' } }]
  },
  [ID.SIGNET_OF_AGILITY]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    attributeBonuses: { precision: 180 },
    enduranceGain: 100,

    cooldown: 30,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [],
    // The active grant commits once and uses the selected skill.
    sideEffects: [
      ...SIGNET_COMPLETED,
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'endurance',
          amount: { skillField: 'enduranceGain' }
        }
      }
    ]
  },
  [ID.INFILTRATORS_SIGNET]: {
    // The active shadowstep participates in movement traits and relic triggers.
    movementSkill: true,
    shadowstepSkill: true,
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [],
    // Activate only after recharge settlement.
    sideEffects: [...SIGNET_COMPLETED, { on: 'castCommit', do: { type: 'thief.restart-signet' } }]
  },
  [ID.HASTE]: {
    cooldown: 20,
    initiativeCost: 0,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.THIEVES_GUILD]: {
    cooldown: 120,
    initiativeCost: 0,
    // Lifetime belongs to the summon; actor attributes and stream startup remain shared policy.
    duration: 24,
    summonAttack: {
      basePower: 1750,
      criticalChance: 0.2,
      criticalDamage: 1.5,
      summons: [
        {
          name: 'Male Dual-Pistol Thief',
          displayName: 'Thief',
          weapon: 'Pistol',
          weaponStrengthProfileId: 'weapon.pistol',
          attacks: [
            {
              skillId: 3669,
              initialDelay: 1.44
            },
            {
              skillId: 3666,
              initialDelay: 3.56
            }
          ]
        },
        {
          name: 'Female Dual-Dagger Thief',
          displayName: 'Thief',
          weapon: 'Dagger',
          weaponStrengthProfileId: 'weapon.dagger',
          attacks: [
            {
              skillId: 3665,
              initialDelay: 1.72
            },
            {
              skillId: 3661,
              initialDelay: 2.52
            },
            {
              skillId: 3662,
              initialDelay: 3.08
            },
            {
              skillId: 3663,
              initialDelay: 3.72
            }
          ]
        },
        {
          name: 'Sword Thief',
          displayName: 'Thief',
          variant: 'Core Thief',
          weapon: 'Sword',
          weaponStrengthProfileId: 'weapon.sword',
          attacks: [
            {
              skillId: 'thief.guild.core.basic',
              initialDelay: 1
            }
          ]
        }
      ]
    },

    castTimeMs: 1000,
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.summon-guild' } }]
  },
  [ID.DAGGER_STORM]: {
    cooldown: 60,
    initiativeCost: 0,
    castTimeMs: 1840,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Dagger Storm',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 2,
        duration: 7,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.DEVOURER_VENOM]: {
    cooldown: 40,
    initiativeCost: 0,

    castTimeMs: 0,
    effects: [
      {
        type: 'buff',
        name: 'devourer-venom',
        kind: 'devourer-venom',
        duration: 24,
        stacks: 2,
        audience: { recipients: RECIPIENT.PARTY }
      }
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'thief.activate-venom',
          id: 'venom',
          effects: [
            { type: 'condition', name: CONDITION.IMMOBILIZED, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1 }
          ]
        }
      }
    ]
  },
  [ID.BASILISK_VENOM]: {
    cooldown: 40,
    initiativeCost: 0,
    castTimeMs: 680,
    // Model only its control contribution on activation; venom sharing and on-hit charges are intentionally omitted.
    effects: [{ type: 'control', controlKind: CONTROL.STUN, atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }]
  },
  [ID.SKELK_VENOM]: {
    cooldown: 25,
    initiativeCost: 0,
    castTimeMs: 680,
    effects: []
  },
  [ID.PITFALL]: {
    cooldown: 3,
    initiativeCost: 0,

    castTimeMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.25 }],
        name: 'Initial Impact Damage',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: PITFALL_PULSE_OFFSETS_MS.map((atMs) => ({ atMs, coefficient: 0.5 })),
          name: 'Pulse Damage',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          ticks: PITFALL_PULSE_OFFSETS_MS.map((atMs) => ({
            atMs,
            condition: CONDITION.VULNERABILITY,
            stacks: 2,
            duration: 6
          })),
          actorType: ACTOR.PLAYER
        },
        {
          type: 'control',
          atMs: 0,
          actorType: ACTOR.PLAYER,
          controlKind: CONTROL.KNOCKDOWN
        }
      ])
    ],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-trap' } }]
  },
  [ID.THOUSAND_NEEDLES]: {
    cooldown: 0,
    initiativeCost: 0,

    castTimeMs: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS, coefficient: 0.5 }],
        name: 'Thousand Needles — Initial Strike'
      },
      {
        type: 'strike',
        ticks: [
          THOUSAND_NEEDLES_INITIAL_DELAY_MS + 1000,
          THOUSAND_NEEDLES_INITIAL_DELAY_MS + 2000,
          THOUSAND_NEEDLES_INITIAL_DELAY_MS + 3000,
          THOUSAND_NEEDLES_INITIAL_DELAY_MS + 4000
        ].map((atMs) => ({ atMs, coefficient: 0.2 })),
        name: 'Thousand Needles — Pulse'
      },
      {
        type: 'condition',
        ticks: [{ atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 3 }]
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 8
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: CONDITION.BLEEDING,
          stacks: 2,
          duration: 5
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 2
        }))
      }
    ]),
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-trap' } }]
  }
});

const THIEF_INFILTRATORS_SIGNET_PULSE = 'thief.infiltrators-signet';

/** Activation and resets start a full interval after readiness; suppression does not credit future initiative. */
function nextInfiltratorsSignetPulse(runtime: ThiefRuntime): number {
  return selectedSkillIdSet(runtime.config.selectedSkillIds).has(ID.INFILTRATORS_SIGNET)
    ? Math.max(runtime.time, runtime.cooldownController.readyAt(ID.INFILTRATORS_SIGNET) ?? 0) + 10
    : Infinity;
}

const infiltratorsSignetPassive = definePeriodicTask<ThiefRuntime>({
  name: THIEF_INFILTRATORS_SIGNET_PULSE,
  background: true,
  priority: 0,
  state: (runtime) => runtime.profession.core.infiltratorsSignetPassive,
  nextAt: nextInfiltratorsSignetPulse,
  run(runtime) {
    if ((runtime.cooldownController.readyAt(ID.INFILTRATORS_SIGNET) ?? 0) <= runtime.time)
      runtime.resourceController.grant('initiative', 1);
  }
});

function restartThiefInfiltratorsSignet(runtime: ThiefRuntime): void {
  infiltratorsSignetPassive.restart(runtime, nextInfiltratorsSignetPulse(runtime));
}

/** The signet owns its passive cadence across activation, cancellation, and cooldown resets. */
export const infiltratorsSignetLifecycle = {
  ...infiltratorsSignetPassive.hooks,
  initialize: restartThiefInfiltratorsSignet,
  sideEffectHandlers: { 'thief.restart-signet': restartThiefInfiltratorsSignet },
  onCastCancel(runtime, cast) {
    // Restart only after the cancelled signet's recharge has settled.
    if (cast.skill.id === ID.INFILTRATORS_SIGNET) restartThiefInfiltratorsSignet(runtime);
  },
  onCooldownReset: restartThiefInfiltratorsSignet
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
