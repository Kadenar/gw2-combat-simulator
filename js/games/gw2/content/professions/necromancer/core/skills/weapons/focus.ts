/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SPINAL_SHIVERS]: {
    implemented: true,
    quicknessCastTimeMs: 800,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 1,
        name: 'Spinal Shivers — Damage—Three Boons'
      },
      {
        type: 'strike',
        coefficient: 3.5,
        hits: 1,
        name: 'Spinal Shivers — Damage—Two Boons'
      },
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Spinal Shivers — Damage—One Boon'
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Spinal Shivers — Damage—No Boons'
      },
      {
        type: 'custom',
        eventType: 'necromancer.chill',
        event: {
          duration: 5
        }
      }
    ]
  },
  [ID.SOUL_GRASP]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 6,
        stacks: 5
      }
    ],
    lifeForceGain: 11
  }
});
