import { COMBO_FINISHER, ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Sword follow-ups remain available for their measured reactivation window.
const OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS = 3;

export const NECROMANCER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
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
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2
      }
    ]
  },
  [ID.RAVENOUS_WAVE]: {
    flipDuration: 3,
    castTimeMs: 400,
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
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 12 } })
          }
        ],
        coefficient: 2,
        hits: 1
      }
    ],
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.SATIATE]: {
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
    ],
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SATIATE } }]
  },
  [ID.PATH_OF_GLUTTONY]: {
    castTimeMs: 760,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ],
    // With no shorter flipDuration, Gorge remains available for this parent's selected cooldown.
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.GORGE]: {
    castTimeMs: 760,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: COMBO_FINISHER.LEAP
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ],
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.GORGE } }]
  },
  [ID.HUNGERING_MAELSTROM]: {
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    castTimeMs: 640,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.75 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 }
    ]),
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.GORMANDIZE]: {
    castTimeMs: 440,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.5 },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 5 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 8 }
    ]),
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.GORMANDIZE } }]
  },
  [ID.DEVOURING_VISAGE]: {
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    castTimeMs: 680,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 10 } })
          }
        ],
        coefficient: 1.5
      },
      {
        type: 'condition',
        condition: CONDITION.FEAR,
        stacks: 1,
        duration: 2
      }
    ]),
    // The skill owns this transaction; its shared helper retains state and lifetime rules.
    sideEffects: [{ on: 'castCommit', do: { type: 'necromancer.weapon-flip' } }]
  },
  [ID.CONSUME]: {
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
        { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 4 },
        { type: 'boon', boon: BOON.MIGHT, duration: 8, stacks: 5 }
      ])
    ],
    // Successful follow-up commitment consumes only this weapon window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.CONSUME } }]
  }
});
