/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GHASTLY_CLAWS]: {
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 1440,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 8 }, (_, index) => ({ atMs: 180 + index * 180, coefficient: 4.6 / 8 })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 12
  },
  [ID.RENDING_CLAWS]: {
    quicknessCastTimeMs: 620,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 7,
        stacks: 2
      }
    ]
  },
  [ID.UNHOLY_FEAST]: {
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  }
});
