/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HAMSTRING]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 400,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 240, condition: 'Bleeding', stacks: 1, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 240, condition: 'Crippled', stacks: 1, duration: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.SEVER_ARTERY]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    dualWieldCastTimeMs: 280,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 200, condition: 'Bleeding', stacks: 1, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GASH]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    dualWieldCastTimeMs: 360,
    // Gash lands its strike at 280ms, but the activation is not safely
    // interruptible until 380ms and still retains its remaining cast lane.
    interruptCommitMs: 380,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: 'Bleeding', stacks: 1, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SAVAGE_LEAP]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 800, condition: 'Crippled', stacks: 1, duration: 3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 800, condition: 'Bleeding', stacks: 3, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RIPOSTE]: {
    implemented: true,
    quicknessCastTimeMs: 1500,
    effects: []
  },
  [ID.IMPALE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 5,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RIP]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 10
      }
    ]
  },
  [ID.ADRENALINE_RUSH]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 3,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.REND]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 960,
    dualWieldCastTimeMs: 720,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 0.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        ticks: [{ atMs: 880, coefficient: 2.5 }],
        name: 'Rend — Follow-Up Damage',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Immobilized', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 880, condition: 'Bleeding', stacks: 6, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  }
});
