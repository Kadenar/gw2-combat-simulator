/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GRASPING_DEAD]: {
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 560, condition: 'Bleeding', stacks: 3, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.PUTRID_CURSE]: {
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Bleeding', stacks: 1, duration: 4.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Poisoned', stacks: 1, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BLOOD_CURSE]: {
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.35 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Bleeding', stacks: 1, duration: 4.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.RENDING_CURSE]: {
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 0.35 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Bleeding', stacks: 1, duration: 4.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FEAST_OF_CORRUPTION]: {
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
    quicknessCastTimeMs: 600,
    effects: [],
    lifeForceGain: 8,
    // Custom: Scales Torment stacks from the target's active condition count; see `core/mechanics/conditions.ts`.
    handlerId: 'necromancer.devouring-darkness',
    flipParentId: null
  }
});
