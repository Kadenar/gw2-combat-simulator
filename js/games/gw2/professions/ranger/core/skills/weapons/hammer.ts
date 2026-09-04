/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HAMMER_STRIKE]: {
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
        damageKind: 'ranger-unleashed-disabled-condition-count'
      }
    ],
    quicknessCastTimeMs: 560
  },
  [ID.UNLEASHED_OVERBEARING_SMASH]: {
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 0.75 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 240, condition: 'Blindness', stacks: 1, duration: 2 }],
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
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        damageKind: 'ranger-unleashed-disabled'
      }
    ],
    quicknessCastTimeMs: 480
  },
  [ID.HEAVY_SMASH]: {
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
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Crippled', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 480
  },
  [ID.THUMP]: {
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
        controlKind: 'knockdown',
        duration: 2
      }
    ],
    quicknessCastTimeMs: 960
  },
  [ID.OVERBEARING_SMASH]: {
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
        controlKind: 'daze'
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
        controlKind: 'daze'
      }
    ],
    quicknessCastTimeMs: 960
  },
  [ID.SAVAGE_SHOCK_WAVE]: {
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
        ticks: [{ atMs: 520, condition: 'Weakness', stacks: 1, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 520, condition: 'Vulnerability', stacks: 8, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 520, condition: 'Immobilized', stacks: 1, duration: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 560
  }
});
