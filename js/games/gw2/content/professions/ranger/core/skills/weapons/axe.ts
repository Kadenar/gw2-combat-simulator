/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.RICOCHET]: {
    implemented: true,
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.9 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 600,
    missileHits: 1
  },
  [ID.SPLITBLADE]: {
    implemented: true,
    interruptCommitMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 480,
            condition: 'Bleeding',
            stacks: 5,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    // Match the observed median Quickness animation, rounded to the 40 ms action tick.
    quicknessCastTimeMs: 560,
    missileHits: 5
  },
  [ID.WINTERS_BITE]: {
    implemented: true,
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 1.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Bleeding', stacks: 3, duration: 12 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Chilled', stacks: 1, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 520,
    // Custom: Arms the Winter's Bite follow-up state; see `core/skills/execution.ts`.
    handlerId: 'ranger.winters-bite',
    missileHits: 1
  },
  [ID.PATH_OF_SCARS]: {
    interruptCommitMs: 360,
    implemented: true,
    // Both range variants share the same weapon-slot recharge after completion.
    mechanicTriggers: [
      {
        type: 'ranger.core.sync-path-of-scars-cooldown',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 1.2 },
          { atMs: 880, coefficient: 1.2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'control',
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'pull'
      }
    ],
    quicknessCastTimeMs: 440,
    missileHits: 2
  },
  [ID.WHIRLING_DEFENSE]: {
    implemented: true,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [200, 360, 600, 840, 1040, 1280, 1520, 1680, 1920, 2160, 2360, 2600].map((atMs) => ({
          atMs,
          coefficient: 0.66
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 4,
        stacks: 1
      },
      {
        type: 'condition',
        ticks: [{ atMs: 2600, condition: 'Vulnerability', stacks: 12, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    quicknessCastTimeMs: 2720
  }
});
