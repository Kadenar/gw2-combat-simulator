/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GHASTLY_CLAWS]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 1440,
    effects: [
      {
        type: 'strike',
        coefficient: 4.6,
        hits: 8,
        atMs: 180,
        intervalMs: 180,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 12
  },
  [ID.RENDING_CLAWS]: {
    implemented: true,
    quicknessCastTimeMs: 620,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 2
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
    implemented: true,
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
