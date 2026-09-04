/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.OPPRESSIVE_COLLAPSE]: {
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 560, condition: 'Torment', stacks: 2, duration: 9 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'control'
      }
    ],
    // Custom: Grants party Might scaled by the target's condition count; see `core/execution/torch.ts`.
    handlerId: 'necromancer.oppressive-collapse'
  },
  [ID.HARROWING_WAVE]: {
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Burning', stacks: 1, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Torment', stacks: 2, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    lifeForceGain: 5
  }
});
