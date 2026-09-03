/**
 * Owns Soulbeast merged-pet skill fragments for the Porcine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_PORCINE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MAUL_ID_41406]: {
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 1.11 },
          { atMs: 440, coefficient: 1.11 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Bleeding', stacks: 2, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 560
  },
  [ID.BRUTAL_CHARGE_ID_46432]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.67,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'knockdown'
      }
    ]
  }
});
