/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.OPPRESSIVE_COLLAPSE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 9,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'control'
        }
      }
    ],
    handlerId: 'necromancer.oppressive-collapse'
  },
  [ID.HARROWING_WAVE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 8,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 6,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 5
  }
});
