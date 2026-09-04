/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Sword follow-ups remain available for their measured reactivation window.
const OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS = 3;

export const NECROMANCER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PATH_OF_GLUTTONY]: {
    quicknessCastTimeMs: 760,
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
    interruptCommitMs: 0,
    quicknessCastTimeMs: 640,
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 720, coefficient: 2.75 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 720, condition: 'Vulnerability', stacks: 5, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ENERVATION_ECHO]: {
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.DEATHLY_ENERVATION]: {
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 2
        }
      }
    ]
  },
  [ID.GORGE]: {
    quicknessCastTimeMs: 760,
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
    quicknessCastTimeMs: 400,
    flipDuration: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ],
    lifeForceGain: 12
  },
  [ID.SATIATE]: {
    quicknessCastTimeMs: 440,
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
    interruptCommitMs: 0,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 480 + index * 280, coefficient: 2.5 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: 'Weakness', stacks: 1, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'Might',
        duration: 8,
        stacks: 5,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.ENERVATION_BLADE]: {
    quicknessCastTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ]
  },
  [ID.DEVOURING_VISAGE]: {
    quicknessCastTimeMs: 680,
    flipDuration: OFF_HAND_SWORD_FOLLOW_UP_WINDOW_SECONDS,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'fear',
        duration: 1.5
      }
    ],
    lifeForceGain: 10
  },
  [ID.GORMANDIZE]: {
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 5
        },
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Vulnerability', stacks: 5, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
