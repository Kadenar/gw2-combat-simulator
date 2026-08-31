/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

// Packet offsets are the canonical Quickness timings measured from EVTC animation starts.
export const GUARDIAN_WEAPONS_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DEFLECTING_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 1.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.SYMBOL_OF_ENERGY]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 1.38,
        hits: 1,
        name: 'Symbol of Energy — Initial Damage'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 2.07 / 4 })),
        name: 'Symbol of Energy — Symbol Damage',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 12
      }
    ]
  },
  [ID.TRUE_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 680, coefficient: 2.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PUNCTURE_SHOT]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HUNTERS_WARD]: {
    implemented: true,
    quicknessCastTimeMs: 720,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 680, coefficient: 0.75 },
          { atMs: 1200, coefficient: 0.75 },
          { atMs: 1720, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: "Hunter's Ward — Arrow Damage"
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2240, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: "Hunter's Ward — Final Impact Damage"
      }
    ]
  }
});
