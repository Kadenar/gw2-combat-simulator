/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Sword follow-ups remain available for their measured reactivation window.
const OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS = 3;

export const NECROMANCER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PATH_OF_GLUTTONY]: {
    // With no shorter flipDuration, Gorge remains available for this parent's selected cooldown.
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }],
    castTimeMs: 760,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.HUNGERING_MAELSTROM]: {
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }],
    castTimeMs: 640,
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.75 },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }
    ])
  },
  [ID.ENERVATION_ECHO]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.DEATHLY_ENERVATION]: {
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2
      }
    ]
  },
  [ID.GORGE]: {
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.GORGE } }],
    castTimeMs: 760,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.RAVENOUS_WAVE]: {
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }],
    castTimeMs: 400,
    flipDuration: 3,
    effects: [
      {
        type: 'strike',
        // Accepted strikes grant live skill tuning through the percentage resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.skill-life-force' }
          }
        ],
        coefficient: 2,
        hits: 1
      }
    ],
    lifeForceGain: 12
  },
  [ID.SATIATE]: {
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SATIATE } }],
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.5
          }
        ]
      }
    ]
  },
  [ID.CONSUME]: {
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CONSUME } }],
    castTimeMs: 520,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 480 + index * 280, coefficient: 2.5 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'condition', condition: 'Weakness', stacks: 1, duration: 4 },
        { type: 'boon', boon: 'Might', duration: 8, stacks: 5 }
      ])
    ]
  },
  [ID.ENERVATION_BLADE]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.DEVOURING_VISAGE]: {
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }],
    castTimeMs: 680,
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Accepted strikes grant live skill tuning through the percentage resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.skill-life-force' }
          }
        ],
        coefficient: 1.5
      },
      { type: 'control', controlKind: 'fear' }
    ]),
    lifeForceGain: 10
  },
  [ID.GORMANDIZE]: {
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.GORMANDIZE } }],
    castTimeMs: 440,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.5 },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 5 },
      { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }
    ])
  }
});
