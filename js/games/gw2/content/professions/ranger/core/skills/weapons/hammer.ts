/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HAMMER_STRIKE]: {
    implemented: true,
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 480
  },
  [ID.UNLEASHED_SAVAGE_SHOCK_WAVE]: {
    interruptCommitMs: 520,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [520, 800, 1080].map((atMs) => ({
          atMs,
          coefficient: 0.8
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: 'ranger-unleashed-disabled-condition-count'
        }
      }
    ],
    quicknessCastTimeMs: 560
  },
  [ID.UNLEASHED_OVERBEARING_SMASH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 0.75 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Blindness',
        stacks: 1,
        duration: 2,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        ticks: [{ atMs: 960, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Unleashed Overbearing Smash - Follow-Up Damage'
      }
    ],
    quicknessCastTimeMs: 960
  },
  [ID.UNLEASHED_THUMP]: {
    implemented: true,
    interruptCommitMs: 800,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 2.3 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6.5,
        stacks: 6,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6.5,
        stacks: 1,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 960
  },
  [ID.HAMMER_SLAM]: {
    implemented: true,
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 640
  },
  [ID.UNLEASHED_WILD_SWING]: {
    implemented: true,
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { damageKind: 'ranger-unleashed-disabled' }
      }
    ],
    quicknessCastTimeMs: 480
  },
  [ID.HEAVY_SMASH]: {
    implemented: true,
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 440
  },
  [ID.WILD_SWING]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 480
  },
  [ID.THUMP]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 1.25 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { controlKind: 'knockdown', duration: 2 }
      }
    ],
    quicknessCastTimeMs: 960
  },
  [ID.OVERBEARING_SMASH]: {
    implemented: true,
    interruptCommitMs: 240,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 0.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { controlKind: 'daze' }
      },
      {
        type: 'strike',
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        ticks: [{ atMs: 800, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: { controlKind: 'daze' }
      }
    ],
    quicknessCastTimeMs: 960
  },
  [ID.SAVAGE_SHOCK_WAVE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 0.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 4,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 6,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 560
  }
});
