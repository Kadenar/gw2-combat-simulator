/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Defines Engineer pistol projectile timing, damage, condition, and combo behavior. */
export const ENGINEER_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FRAGMENTATION_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 520,
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
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.4,
          hits: 1,
          name: 'Fragmentation Shot',
          interruptCommitMs: 360,
          actorType: 'player',
          projectile: true
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 1,
          duration: 6,
          interruptCommitMs: 360,
          actorType: 'player'
        }
      ]
    )
  },
  [ID.POISON_DART_VOLLEY]: {
    castTimeMs: 840,
    cooldown: 8,
    // Poison Dart Volley is a channel: interruption retains landed darts and cancels only its future packets.
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, coefficient: 2 / 5 })),
        name: 'Poison Dart Volley',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, condition: 'Poisoned', stacks: 1, duration: 7 })),
        actorType: 'player'
      }
    ])
  },
  [ID.STATIC_SHOT]: {
    castTimeMs: 320,
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
    castTimeMs: 560,
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
    castTimeMs: 560,
    interruptCommitMs: 360,
    // Committed flame casts keep their remaining lockout before the next player input.
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 12,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      // The flame and burning land before aftercast; scheduling at cast end drops committed shortened casts.
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Maximum Damage',
        actorType: 'player'
      },
      // Each Burning stack is a separate application and can trigger its own relic check.
      ...Array.from({ length: 3 }, () => ({
        type: 'condition' as const,
        condition: 'Burning' as const,
        stacks: 1,
        duration: 4.5,
        actorType: 'player' as const
      }))
    ])
  }
});
