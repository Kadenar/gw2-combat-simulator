/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SYMBOL_OF_VENGEANCE]: {
    implemented: true,
    quicknessCastTimeMs: 800,
    // The Light field begins with the first symbol pulse and lasts through the fifth.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Light', duration: 4, startMs: 680, startAnchor: 'castStart' }],
    effects: [
      {
        type: 'strike',
        ticks: [680, 1680, 2680, 3680, 4680].map((atMs) => ({
          atMs,
          coefficient: 0.6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 680 + index * 1000,
          condition: 'Bleeding',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 1.5
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 1.5,
        atMs: 1680,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 1.5,
        atMs: 2680,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 1.5,
        atMs: 3680,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 1.5,
        atMs: 4680,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ]
  },
  [ID.SEARING_SLASH]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 480, coefficient: 1.2 },
          { atMs: 640, coefficient: 1.2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Burning', stacks: 2, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BLEEDING_EDGE]: {
    implemented: true,
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 480, coefficient: 0.36 },
          { atMs: 640, coefficient: 0.36 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 640, condition: 'Bleeding', stacks: 2, duration: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.CORE_CLEAVE]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 360, coefficient: 0.36 },
          { atMs: 600, coefficient: 0.36 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 600, condition: 'Bleeding', stacks: 2, duration: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BLAZING_EDGE]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: 'Burning', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'pull'
      }
    ]
  }
});
