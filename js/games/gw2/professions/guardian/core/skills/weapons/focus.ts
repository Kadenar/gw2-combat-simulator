/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SHIELD_OF_WRATH]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 4000, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RAY_OF_JUDGMENT]: {
    quicknessCastTimeMs: 600,
    // Once launched, the ray keeps striking even when the remaining cast animation is cancelled.
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [1040, 1520, 2000, 2480, 2960, 3440].map((atMs) => ({ atMs, coefficient: 4.05 / 6 })),
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'blind'
      }
    ]
  }
});
