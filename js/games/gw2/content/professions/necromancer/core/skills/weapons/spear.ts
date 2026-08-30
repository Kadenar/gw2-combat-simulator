/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.EXTIRPATE]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    effects: [
      {
        type: 'strike',
        coefficient: 3.8,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Whirl',
            applications: 3,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Might',
        duration: 8,
        stacks: 5,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 3,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'buff',
        kind: 'extirpation',
        duration: 4,
        stacks: 3,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 12,
    handlerId: 'necromancer.extirpate'
  },
  [ID.DARK_SLASH]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ADDLE]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1.9,
        hits: 1,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 10,
    handlerId: 'necromancer.addle'
  },
  [ID.DEADLY_SLICE]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    handlerId: 'necromancer.deadly-slice'
  },
  [ID.SINISTER_STAB]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 2
        },
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 5,
    handlerId: 'necromancer.sinister-stab'
  },
  [ID.PERFORATE]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 840,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 0.5
          },
          {
            atMs: 480,
            coefficient: 0.5
          },
          {
            atMs: 520,
            coefficient: 0.5
          },
          {
            atMs: 560,
            coefficient: 0.5
          },
          {
            atMs: 640,
            coefficient: 0.5
          },
          {
            atMs: 720,
            coefficient: 0.5
          },
          {
            atMs: 760,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.2
          }
        ]
      }
    ],
    handlerId: 'necromancer.perforate'
  },
  [ID.ISOLATE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        event: {
          duration: 3
        }
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 8,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    flipDuration: 3,
    flipActivationAtMs: 660
  },
  [ID.DISTRESS]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: 'necromancer.distress'
  }
});
