/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Defines Engineer pistol projectile timing, damage, condition, and combo behavior. */
export const ENGINEER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FRAGMENTATION_SHOT]: {
    quicknessCastTimeMs: 520,
    cooldown: 0,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Fragmentation Shot',
        interruptCommitMs: 360,
        persistsAfterInterrupt: true,
        actorType: 'player',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Bleeding', stacks: 1, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        interruptCommitMs: 360,
        persistsAfterInterrupt: true,
        actorType: 'player'
      }
    ]
  },
  [ID.POISON_DART_VOLLEY]: {
    quicknessCastTimeMs: 840,
    cooldown: 8,
    // Poison Dart Volley is a channel: interruption retains landed darts and cancels only its future packets.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 168 + index * 168, coefficient: 2 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Poison Dart Volley',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 168, condition: 'Poisoned', stacks: 1, duration: 7 },
          { atMs: 336, condition: 'Poisoned', stacks: 1, duration: 7 },
          { atMs: 504, condition: 'Poisoned', stacks: 1, duration: 7 },
          { atMs: 672, condition: 'Poisoned', stacks: 1, duration: 7 },
          { atMs: 840, condition: 'Poisoned', stacks: 1, duration: 7 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player'
      }
    ]
  },
  [ID.STATIC_SHOT]: {
    quicknessCastTimeMs: 320,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Static Shot',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'blind',
        actorType: 'player'
      }
    ]
  },
  [ID.GLUE_SHOT]: {
    quicknessCastTimeMs: 560,
    cooldown: 20,
    duration: 5,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Glue Shot',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 0, condition: 'Crippled', stacks: 1, duration: 2 },
          { atMs: 1000, condition: 'Crippled', stacks: 1, duration: 2 },
          { atMs: 2000, condition: 'Crippled', stacks: 1, duration: 2 },
          { atMs: 3000, condition: 'Crippled', stacks: 1, duration: 2 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1.5,
        actorType: 'player'
      }
    ]
  },
  [ID.BLOWTORCH]: {
    quicknessCastTimeMs: 560,
    interruptCommitMs: 360,
    cooldown: 12,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Maximum Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 4.5,
        actorType: 'player'
      }
    ]
  }
});
