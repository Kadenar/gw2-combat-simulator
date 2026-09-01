/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const NECROMANCER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.VILE_BLAST]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 560, condition: 'Poisoned', stacks: 5, duration: 6 }],
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
    lifeForceGain: 4
  },
  [ID.WEEPING_SHOTS]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 240, coefficient: 0.4 },
          { atMs: 360, coefficient: 0.4 },
          { atMs: 520, coefficient: 0.4 },
          { atMs: 640, coefficient: 0.4 },
          { atMs: 760, coefficient: 0.4 },
          { atMs: 880, coefficient: 0.4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 240, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 360, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 520, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 640, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 760, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 880, condition: 'Torment', stacks: 1, duration: 4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 6,
        stacks: 6
      }
    ],
    lifeForceGain: 9
  },
  [ID.VICIOUS_SHOT]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 600,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.65 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 360, condition: 'Torment', stacks: 1, duration: 3.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
