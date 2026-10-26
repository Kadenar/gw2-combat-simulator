import { ACTOR, CONTROL, COMBO_FIELD, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const NECROMANCER_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.DUSK_STRIKE]: {
    castTimeMs: 480,
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 2 } })
          }
        ],
        coefficient: 1.2,
        hits: 1
      }
    ]
  },
  [ID.FADING_TWILIGHT]: {
    castTimeMs: 640,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 2 } })
          }
        ],
        ticks: [{ atMs: 520, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CHILLING_SCYTHE]: {
    castTimeMs: 920,
    // Once the strike lands, the next skill may safely cancel the remaining Chilling Scythe aftercast.
    interruptCommitMs: 720,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Only this selected application owns its accepted-impact reward.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 5 } })
          },
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'rechargeReset', skillIds: [ID.GRAVEDIGGER] }
          }
        ],
        coefficient: 1.8
      },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 2 }
    ])
  },
  [ID.GRAVEDIGGER]: {
    castTimeMs: 1080,
    // The strike commits at 840 ms, but cancelling after it lands retains the full skill lockout.
    interruptCommitMs: 840,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 840, coefficient: 3.6 }],
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: COMBO_FINISHER.WHIRL,
            applications: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Semantic completion samples health once; a later animation-tail crossing cannot reset recharge.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime) => runtime.combat.targetHealthBelow(0.5),
        do: { type: 'rechargeReset', skillIds: [ID.GRAVEDIGGER] }
      }
    ]
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
            finisherType: COMBO_FINISHER.WHIRL,
            applications: 2
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
        canCrit: false,
        damageKind: 'life-steal'
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        duration: 10,
        stacks: 12
      }
    ]
  },
  [ID.NIGHTFALL]: {
    castTimeMs: 480,
    // The field commits at 440 ms; every delayed pulse then survives the interrupted cast.
    interruptCommitMs: 440,

    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'pulse', grant: { percent: 7 } })
          }
        ],
        // EVTC records four Quickness pulses at 560 ms and fixed one-second intervals.
        ticks: [560, 1560, 2560, 3560].map((atMs) => ({ atMs, coefficient: 4.6 / 4 })),
        comboFields: [{ ownerId: 'necromancer', fieldType: COMBO_FIELD.DARK, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 3,
          applications: 4,
          atMs: 400,
          intervalMs: 1000,
          intervalTimingScale: 'fixed'
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 2,
          applications: 4,
          atMs: 400,
          intervalMs: 1000,
          intervalTimingScale: 'fixed'
        }
      ])
    ]
  },
  [ID.GRASPING_DARKNESS]: {
    castTimeMs: 520,
    // The projectile commits after 120 ms, so its delayed hit and attached effects survive later interruption.
    interruptCommitMs: 120,

    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 1440, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          // Accepted strikes apply their declared percentage through the shared resource owner.
          reactions: [
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'each',
              when: (_runtime, { event }) => Number(event.coefficient) > 0,
              do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 10 } })
            }
          ],
          coefficient: 1.3
        },
        { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 4 },
        { type: 'control', controlKind: CONTROL.PULL }
      ]
    )
  }
});
