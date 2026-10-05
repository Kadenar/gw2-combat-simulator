import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const NECROMANCER_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.GRASPING_DEAD]: {
    castTimeMs: 880,
    // Committed casts retain the full lockout so cancelling cannot skip the aftercast.
    interruptCommitMs: 640,
    retainsCastLockoutAfterInterrupt: true,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 560, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8 },
        { type: 'condition', condition: 'Bleeding', stacks: 3, duration: 10 }
      ]
    )
  },
  [ID.PUTRID_CURSE]: {
    castTimeMs: 600,
    interruptCommitMs: 520,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.5 },
        { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4.5 },
        { type: 'condition', condition: 'Poisoned', stacks: 1, duration: 6 }
      ]
    )
  },
  [ID.BLOOD_CURSE]: {
    castTimeMs: 440,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.35 },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4.5 }
    ])
  },
  [ID.RENDING_CURSE]: {
    castTimeMs: 600,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.35 },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4.5 }
    ])
  },
  [ID.FEAST_OF_CORRUPTION]: {
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({
              id: 'life-force',
              unit: 'hit',
              grant: { percent: 8, perCondition: { percent: 1, count: { kind: 'live-target', maximum: 5 } } }
            })
          }
        ],
        coefficient: 0.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4
      }
    ],

    flipSkillId: null
  },
  [ID.DEVOURING_DARKNESS]: {
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castStart', do: { type: 'necromancer.devouring-impact' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 600,
    // The replacement handler scales this per-condition payload using the live target state.
    maximumConditions: 5,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({
              id: 'life-force',
              unit: 'hit',
              grant: { percent: 8, perCondition: { percent: 1, count: { kind: 'packet-snapshot' } } }
            })
          }
        ],
        coefficient: 1.16
      },
      { type: 'condition', condition: 'Torment', stacks: 1, duration: 4 }
    ],

    flipParentId: null
  }
});
