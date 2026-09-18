/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
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
    castTimeMs: 480
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
    castTimeMs: 560
  },
  [ID.UNLEASHED_OVERBEARING_SMASH]: {
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.75
        },
        {
          type: 'condition',
          condition: 'Blindness',
          stacks: 1,
          duration: 2
        }
      ]),
      {
        type: 'strike',
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        ticks: [{ atMs: 960, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Unleashed Overbearing Smash - Follow-Up Damage'
      }
    ],
    castTimeMs: 960
  },
  [ID.UNLEASHED_THUMP]: {
    interruptCommitMs: 800,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.3
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6.5,
        stacks: 6
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6.5,
        stacks: 1
      }
    ]),
    castTimeMs: 960
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
    castTimeMs: 640
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
    castTimeMs: 480
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
    castTimeMs: 440
  },
  [ID.WILD_SWING]: {
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      }
    ]),
    castTimeMs: 480
  },
  [ID.THUMP]: {
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.25
      },
      {
        type: 'control',
        controlKind: 'knockdown'
      }
    ]),
    castTimeMs: 960
  },
  [ID.OVERBEARING_SMASH]: {
    interruptCommitMs: 240,
    effects: [
      ...impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.4
        },
        {
          type: 'control',
          controlKind: 'daze'
        }
      ]),
      ...impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
          coefficient: 1
        },
        {
          type: 'control',
          sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
          controlKind: 'daze'
        }
      ])
    ],
    castTimeMs: 960
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
      ...impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'condition',
          condition: 'Weakness',
          stacks: 1,
          duration: 4
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 8,
          duration: 6
        },
        {
          type: 'condition',
          condition: 'Immobilized',
          stacks: 1,
          duration: 2
        }
      ])
    ],
    castTimeMs: 560
  }
});
