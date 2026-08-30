/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GRASPING_DEAD]: {
    implemented: true,
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.PUTRID_CURSE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 6,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BLOOD_CURSE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.35,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.RENDING_CURSE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.35,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4.5,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FEAST_OF_CORRUPTION]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4
      }
    ],
    lifeForceGain: 8,
    flipSkillId: null
  },
  [ID.DEVOURING_DARKNESS]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [],
    lifeForceGain: 8,
    handlerId: 'necromancer.devouring-darkness',
    flipParentId: null
  }
});
