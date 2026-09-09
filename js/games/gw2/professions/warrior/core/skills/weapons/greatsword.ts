/** Core Warrior greatsword packets use nearest-40 ms offsets to remove false timing precision. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.GREATSWORD_SWING]: {
    quicknessCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8
      }
    ]
  },
  [ID.GREATSWORD_SLICE]: {
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8
      }
    ]
  },
  [ID.BRUTAL_STRIKE]: {
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.RUSH]: {
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  },
  [ID.WHIRLWIND_ATTACK]: {
    quicknessCastTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.665,
        hits: 1
      }
    ]
  },
  [ID.BLADETRAIL]: {
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 520, coefficient: 1.5 },
          { atMs: 1520, coefficient: 1.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HUNDRED_BLADES]: {
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 2440,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 320, coefficient: 0.775 },
          { atMs: 480, coefficient: 0.775 },
          { atMs: 680, coefficient: 0.775 },
          { atMs: 880, coefficient: 0.775 },
          { atMs: 1160, coefficient: 0.775 },
          { atMs: 1320, coefficient: 0.775 },
          { atMs: 1560, coefficient: 0.775 },
          { atMs: 1800, coefficient: 0.775 },
          {
            atMs: 2280,
            coefficient: 1.5,
            name: 'Hundred Blades — Final Strike Damage'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
