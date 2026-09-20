/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_SCEPTER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SHADOW_BOLT]: {
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.33,
        hits: 1,
        name: 'Shadow Bolt',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ])
  },
  [ID.ENDLESS_NIGHT]: {
    castTimeMs: 1920,
    cooldown: 0,
    initiativeCost: 3,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [280, 560, 840, 1080, 1360, 1640, 1920].map((atMs) => ({
          atMs,
          coefficient: 2.31 / 7
        })),
        name: 'Endless Night',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 280, condition: 'Slow', stacks: 1, duration: 1.5 }],
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [280, 560, 840, 1080, 1360, 1640, 1920].map((atMs) => ({
          atMs,
          condition: 'Torment',
          stacks: 1,
          duration: 6
        })),
        actorType: 'player'
      }
    ]),
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Pistol'
  },
  [ID.TRIPLE_BOLT]: {
    castTimeMs: 1080,
    cooldown: 0,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.45 }],
        name: 'Triple Bolt',
        actorType: 'player'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 0.45 }],
        name: 'Triple Bolt',
        actorType: 'player'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1040, coefficient: 0.45 }],
        name: 'Triple Bolt',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [320, 640, 1040].map((atMs) => ({ atMs, condition: 'Torment', stacks: 1, duration: 5 })),
        actorType: 'player'
      }
    ])
  },
  [ID.TRIPLE_THREAT]: {
    castTimeMs: 1000,
    cooldown: 0,
    initiativeCost: 4,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [320, 680, 1000].map((atMs) => ({
          atMs,
          coefficient: 1.35 / 3
        })),
        name: 'Triple Threat',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [320, 680, 1000].map((atMs) => ({ atMs, condition: 'Torment', stacks: 1, duration: 4 })),
        actorType: 'player'
      }
    ]),
    requiredMainHand: 'Scepter',
    requiredOffHand: false
  },
  [ID.DOUBLE_BOLT]: {
    castTimeMs: 640,
    cooldown: 0,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.375 }],
        name: 'Double Bolt',
        actorType: 'player'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 0.375 }],
        name: 'Double Bolt',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [320, 600].map((atMs) => ({ atMs, condition: 'Torment', stacks: 1, duration: 4 })),
        actorType: 'player'
      }
    ])
  },
  [ID.TWILIGHT_COMBO]: {
    castTimeMs: 760,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 640, coefficient: 1 }],
        name: 'Initial Attack',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 800, coefficient: 0.5 }],
        name: 'Secondary Attack',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'condition',
          condition: 'Chilled',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Poisoned',
          stacks: 1,
          duration: 5,
          actorType: 'player'
        }
      ]),
      {
        type: 'condition',
        ticks: [{ atMs: 800, condition: 'Torment', stacks: 3, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Dagger'
  },
  [ID.MEASURED_SHOT]: {
    castTimeMs: 560,
    // Commit the shot at 320 ms, preserving its impact and remaining cast lockout after interruption.
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 0,
    initiativeCost: 4,
    effects: impactEffects(
      {
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      [
        {
          type: 'strike',
          coefficient: 0.33,
          hits: 1,
          name: 'Measured Shot',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Immobilized',
          stacks: 1,
          duration: 1,
          actorType: 'player'
        }
      ]
    ),
    movementSkill: true,
    shadowstepSkill: true,
    requiredMainHand: 'Scepter',
    requiredOffHand: 'Pistol'
  },
  [ID.SHADOWSQUALL]: {
    // Custom: Consumes stealth and applies Revealed after the attack; see `core/mechanics/stealth.ts`.
    handlerId: 'thief.stealth-attack',
    castTimeMs: 1960,
    cooldown: 0,
    initiativeCost: 0,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [240, 480, 720, 1000, 1240, 1480, 1720, 1960].map((atMs) => ({ atMs, coefficient: 1.6 / 8 })),
        name: 'Shadowsquall',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [240, 480, 720, 1000, 1240, 1480, 1720, 1960].map((atMs) => ({
          atMs,
          condition: 'Poisoned',
          stacks: 1,
          duration: 3
        })),
        actorType: 'player'
      }
    ]),
    requiredMainHand: 'Scepter',
    stealthAttack: true
  },
  [ID.SHADOW_SAP]: {
    castTimeMs: 600,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.77 }],
        name: 'Shadow Sap',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  }
});
