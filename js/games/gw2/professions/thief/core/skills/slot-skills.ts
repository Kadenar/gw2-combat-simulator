import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

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
    castTimeMs: 0,
    cooldown: 18,
    initiativeCost: 0,
    effects: []
  },
  [ID.PREPARE_THOUSAND_NEEDLES]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.prepare-trap' } }],

    castTimeMs: 600,
    // Placement survives cancellation once the preparation commits.
    interruptCommitMs: 400,
    cooldown: 30,
    rechargeAnchor: 'castStart',
    initiativeCost: 0,
    durationMultiplier: 3,
    effects: []
  },
  [ID.HIDE_IN_SHADOWS]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }],
    // The heal occupies its full recorded animation before granting stealth.
    castTimeMs: 920,
    cooldown: 25,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.CALTROPS]: {
    castTimeMs: 920,
    // Once placed, the field keeps pulsing after the cast is interrupted.
    interruptCommitMs: 800,
    cooldown: 24,
    initiativeCost: 0,
    durationMultiplier: 3,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'condition',
        // Apply one bleed on placement, then ten more at one-second intervals.
        ticks: Array.from({ length: 11 }, (_, index) => ({
          atMs: index * 1000,
          condition: 'Bleeding',
          stacks: 1,
          duration: 10
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: index * 1000,
          condition: 'Crippled',
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.SPIDER_VENOM]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-venom' } }],

    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      { type: 'buff', kind: 'spider-venom', duration: 24, stacks: 6, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.BLINDING_POWDER]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.stealth' } }],
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Blindness',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.ASSASSINS_SIGNET]: {
    // Activate only after recharge settlement.
    sideEffects: [...SIGNET_COMPLETED, { on: 'castCommit', do: { type: 'thief.assassins-signet' } }],

    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: []
  },
  [ID.SIGNET_OF_MALICE]: {
    sideEffects: SIGNET_COMPLETED,
    castTimeMs: 200,
    cooldown: 12,
    initiativeCost: 0,
    effects: []
  },
  [ID.SKALE_VENOM]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-venom' } }],

    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: [
      { type: 'buff', kind: 'skale-venom', duration: 24, stacks: 4, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.PREPARE_PITFALL]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.prepare-trap' } }],

    castTimeMs: 360,
    cooldown: 25,
    rechargeAnchor: 'castStart',
    initiativeCost: 0,
    durationMultiplier: 3,
    effects: []
  },
  [ID.SIGNET_OF_AGILITY]: {
    // The active grant commits once and uses the selected balance profile.
    sideEffects: [
      ...SIGNET_COMPLETED,
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'endurance',
          amount: { profile: PROFILE.signetOfAgility, field: 'resourceGain' }
        }
      }
    ],
    castTimeMs: 0,
    cooldown: 30,
    initiativeCost: 0,
    effects: []
  },
  [ID.INFILTRATORS_SIGNET]: {
    // Activate only after recharge settlement.
    sideEffects: [...SIGNET_COMPLETED, { on: 'castCommit', do: { type: 'thief.restart-signet' } }],
    // The active shadowstep participates in movement traits and relic triggers.
    movementSkill: true,
    shadowstepSkill: true,
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: []
  },
  [ID.HASTE]: {
    castTimeMs: 0,
    cooldown: 20,
    initiativeCost: 0,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.THIEVES_GUILD]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.summon-guild' } }],

    castTimeMs: 1000,
    cooldown: 120,
    initiativeCost: 0,
    effects: [],
    summonAttack: {
      basePower: 1750,
      criticalChance: 0.2,
      criticalDamage: 1.5,
      duration: 24,
      summons: [
        {
          name: 'Male Dual-Pistol Thief',
          displayName: 'Thief',
          weapon: 'Pistol',
          weaponStrengthProfileId: 'weapon.pistol',
          attacks: [
            {
              name: 'Black Powder',
              skillId: 3669,
              coefficientPerHit: 0.8,
              hits: 1,
              initialDelay: 1.44
            },
            {
              name: 'Unload',
              skillId: 3666,
              coefficientPerHit: 0.175,
              hits: 12,
              initialDelay: 3.56,
              interval: 5.8
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
              name: 'Scorpion Wire',
              skillId: 3665,
              coefficientPerHit: 1.5,
              hits: 1,
              initialDelay: 1.72,
              conditions: [
                {
                  condition: 'Poisoned',
                  stacks: 2,
                  duration: 10
                },
                {
                  condition: 'Weakness',
                  stacks: 1,
                  duration: 4
                }
              ]
            },
            {
              name: 'Twisting Fang I',
              skillId: 3661,
              coefficientPerHit: 0.6,
              hits: 2,
              initialDelay: 2.52,
              interval: 2.68
            },
            {
              name: 'Twisting Fang II',
              skillId: 3662,
              coefficientPerHit: 1.6,
              hits: 1,
              initialDelay: 3.08,
              interval: 2.68
            },
            {
              name: 'Twisting Fang III',
              skillId: 3663,
              coefficientPerHit: 2.5,
              hits: 1,
              initialDelay: 3.72,
              interval: 2.68
            }
          ]
        },
        {
          name: 'Sword Thief',
          displayName: 'Thief',
          variant: 'Core Thief',
          weapon: 'Sword',
          weaponStrengthProfileId: 'weapon.sword',
          // The core summon owns its basic attack, so an empty list can disable it.
          attacks: [{ name: 'Basic Attack', coefficientPerHit: 1.2, hits: 1, initialDelay: 1, interval: 1 }]
        }
      ]
    }
  },
  [ID.DAGGER_STORM]: {
    castTimeMs: 1840,
    cooldown: 60,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Dagger Storm',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 7,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ])
  },
  [ID.DEVOURER_VENOM]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-venom' } }],

    castTimeMs: 0,
    cooldown: 40,
    initiativeCost: 0,
    effects: [
      { type: 'buff', kind: 'devourer-venom', duration: 24, stacks: 2, audience: { recipients: 'party' as const } }
    ]
  },
  [ID.BASILISK_VENOM]: {
    castTimeMs: 680,
    cooldown: 40,
    initiativeCost: 0,
    // Model only its control contribution on activation; venom sharing and on-hit charges are intentionally omitted.
    effects: [{ type: 'control', controlKind: 'stun', atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }]
  },
  [ID.SKELK_VENOM]: {
    castTimeMs: 680,
    cooldown: 25,
    initiativeCost: 0,
    effects: []
  },
  [ID.PITFALL]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-trap' } }],

    castTimeMs: 0,
    cooldown: 3,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.25 }],
        name: 'Initial Impact Damage',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: PITFALL_PULSE_OFFSETS_MS.map((atMs) => ({ atMs, coefficient: 0.5 })),
          name: 'Pulse Damage',
          actorType: 'player'
        },
        {
          type: 'condition',
          ticks: PITFALL_PULSE_OFFSETS_MS.map((atMs) => ({
            atMs,
            condition: 'Vulnerability',
            stacks: 2,
            duration: 6
          })),
          actorType: 'player'
        },
        {
          type: 'control',
          atMs: 0,
          actorType: 'player',
          controlKind: 'knockdown'
        }
      ])
    ]
  },
  [ID.THOUSAND_NEEDLES]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.activate-trap' } }],

    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 0,
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
        ticks: [{ atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS, condition: 'Immobilized', stacks: 1, duration: 3 }]
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: 'Poisoned',
          stacks: 1,
          duration: 8
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: 'Bleeding',
          stacks: 2,
          duration: 5
        }))
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: THOUSAND_NEEDLES_INITIAL_DELAY_MS + index * 1000,
          condition: 'Crippled',
          stacks: 1,
          duration: 2
        }))
      }
    ])
  }
});

const THIEF_INFILTRATORS_SIGNET_PULSE = 'thief.infiltrators-signet';

/**
 * Infiltrator's Signet pulses ten seconds after it last became ready. Each restart owns the next pulse instant, so an
 * earlier pulse still in the queue retires itself instead of being cancelled.
 */
function restartThiefInfiltratorsSignet(runtime: ThiefRuntime): void {
  const core = runtime.profession.core;
  if (!selectedSkillIdSet(runtime.config.selectedSkillIds).has(ID.INFILTRATORS_SIGNET)) return;
  const at = canonicalTime(
    Math.max(runtime.time, runtime.cooldownController.readyAt(ID.INFILTRATORS_SIGNET) || 0) + 10
  );
  core.infiltratorsSignetPulseAt = at;
  runtime.schedule(THIEF_INFILTRATORS_SIGNET_PULSE, at, { at });
}

/** Grants one initiative while the signet is off cooldown, then schedules the next pulse. */
function thiefInfiltratorsSignetPulse(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  if ((data as { at: number }).at !== core.infiltratorsSignetPulseAt) return;
  if ((runtime.cooldownController.readyAt(ID.INFILTRATORS_SIGNET) || 0) <= runtime.time)
    runtime.resourceController.grant('initiative', 1);
  restartThiefInfiltratorsSignet(runtime);
}

/** The signet owns its passive cadence across activation, cancellation, and cooldown resets. */
export const infiltratorsSignetLifecycle = {
  initialize: restartThiefInfiltratorsSignet,
  sideEffectHandlers: { 'thief.restart-signet': restartThiefInfiltratorsSignet },
  onCastCancel(runtime, cast) {
    // Restart only after the cancelled signet's recharge has settled.
    if (cast.skill.id === ID.INFILTRATORS_SIGNET) restartThiefInfiltratorsSignet(runtime);
  },
  onCooldownReset: restartThiefInfiltratorsSignet,
  // Passive regeneration must not prolong an isolated active-skill preview.
  backgroundTasks: [THIEF_INFILTRATORS_SIGNET_PULSE],
  tasks: { [THIEF_INFILTRATORS_SIGNET_PULSE]: thiefInfiltratorsSignetPulse }
} satisfies RuntimeHooks<ThiefRuntimeState, ThiefSkill>;
