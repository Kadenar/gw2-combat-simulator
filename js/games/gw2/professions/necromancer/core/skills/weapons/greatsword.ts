/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DUSK_STRIKE]: {
    interruptCommitMs: 440,
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      }
    ],
    lifeForceGain: 2
  },
  [ID.GRASPING_DARKNESS]: {
    // The projectile commits after 120 ms, so its delayed hit and attached effects survive later interruption.
    interruptCommitMs: 120,
    commitAtMs: 120,
    castTimeMs: 520,
    lifeForceOnHit: 10,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 1440, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.3 },
        { type: 'condition', condition: 'Chilled', stacks: 1, duration: 4 },
        { type: 'control', controlKind: 'pull' }
      ]
    ),
    // Custom: Checks projectile commitment and grants life force on the committed hit; see `core/execution/greatsword.ts`.
    handlerId: 'necromancer.grasping-darkness'
  },
  [ID.NIGHTFALL]: {
    // The field commits at 440 ms; every delayed pulse then survives the interrupted cast.
    interruptCommitMs: 440,
    castTimeMs: 480,
    lifeForcePerPulse: 7,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        // EVTC records four Quickness pulses at 560 ms and fixed one-second intervals.
        ticks: [560, 1560, 2560, 3560].map((atMs) => ({ atMs, coefficient: 4.6 / 4 })),
        comboFields: [{ ownerId: 'necromancer', fieldType: 'Dark', duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        {
          type: 'blind',
          applications: 4,
          atMs: 400,
          intervalMs: 1000,
          intervalTimingScale: 'fixed'
        },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 2,
          applications: 4,
          atMs: 400,
          intervalMs: 1000,
          intervalTimingScale: 'fixed'
        }
      ])
    ],
    // Custom: Checks field commitment and grants life force with each committed pulse; see `core/execution/greatsword.ts`.
    handlerId: 'necromancer.nightfall'
  },
  [ID.CHILLING_SCYTHE]: {
    castTimeMs: 920,
    // Once the strike lands, the next skill may safely cancel the remaining Chilling Scythe aftercast.
    interruptCommitMs: 720,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.8 },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 2 }
    ]),
    lifeForceGain: 5,
    // Custom: Resets Gravedigger after a committed strike; see `core/execution/greatsword.ts`.
    handlerId: 'necromancer.chilling-scythe'
  },
  [ID.GRAVEDIGGER]: {
    castTimeMs: 1080,
    // The strike commits at 840 ms, but cancelling after it lands retains the full skill lockout.
    interruptCommitMs: 840,
    retainsCastLockoutAfterInterrupt: true,
    // Completing Gravedigger resets its recharge once the target is below half health.
    mechanicTriggers: [
      {
        type: 'necromancer.core.reset-gravedigger-below-half',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 840, coefficient: 3.6 }],
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Whirl',
            applications: 3,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FADING_TWILIGHT]: {
    castTimeMs: 640,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 2
  },
  [ID.DEATH_SPIRAL]: {
    castTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Whirl',
            applications: 2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        name: 'Death Spiral — Life Siphon',
        skillName: 'Death Spiral — Life Siphon',
        parentSkillName: 'Death Spiral',
        flatStrikeBase: 3517,
        flatStrikePowerCoeff: 0.01,
        noCrit: true,
        damageKind: 'life-steal'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 10,
        stacks: 12
      }
    ]
  }
});
