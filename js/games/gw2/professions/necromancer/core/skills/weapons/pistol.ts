/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.VILE_BLAST]: {
    castTimeMs: 600,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1 },
      { type: 'condition', condition: 'Poisoned', stacks: 5, duration: 6 },
      { type: 'control', controlKind: 'control' }
    ]),
    lifeForceGain: 4
  },
  [ID.WEEPING_SHOTS]: {
    castTimeMs: 840,
    // Interruption preserves landed packets and cancels the remaining shots.
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: [240, 360, 520, 640, 760, 880].map((atMs) => ({ atMs, coefficient: 0.4 }))
        },
        {
          type: 'condition',
          ticks: [240, 360, 520, 640, 760, 880].map((atMs) => ({ atMs, condition: 'Torment', stacks: 1, duration: 4 }))
        }
      ]),
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
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    interruptMode: 'per-packet',
    castTimeMs: 600,
    comboFinishers: [
      {
        ownerId: 'necromancer',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.65 },
      { type: 'condition', condition: 'Torment', stacks: 1, duration: 3.5 }
    ])
  }
});
