/**
 * Owns Soulbeast merged-pet skill fragments for the Archetype family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_ARCHETYPE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PRIMAL_CRY]: {
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 3,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 9,
        duration: 6
      }
    ],
    quicknessCastTimeMs: 833
  },
  [ID.WORLDLY_IMPACT]: {
    interruptCommitMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 520, coefficient: 1.89 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 680
  },
  [ID.PRELUDE_LASH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.01,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 167
  },
  [ID.SPIRITUAL_REPRIEVE]: {
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 3,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 667
  },
  [ID.UNFLINCHING_FORTITUDE]: {
    effects: [],
    quicknessCastTimeMs: 167
  }
});
