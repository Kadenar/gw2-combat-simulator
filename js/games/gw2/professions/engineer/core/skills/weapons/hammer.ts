/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Defines Engineer hammer skill timing, damage, control, conditions, boons, and combo behavior. */
export const ENGINEER_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.NEGATIVE_BASH]: {
    castTimeMs: 640,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Negative Bash',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'player'
      }
    ])
  },
  [ID.SHOCK_SHIELD]: {
    castTimeMs: 1200,
    cooldown: 18,
    blockDuration: 2,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 240 + index * 240, coefficient: 1.25 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Shock Shield',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  [ID.ELECTRO_WHIRL]: {
    castTimeMs: 680,
    cooldown: 6,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [360, 680].map((atMs) => ({ atMs, coefficient: 3 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Electro-whirl',
        actorType: 'player',
        damageKind: 'explosion'
      }
    ]
  },
  [ID.EQUALIZING_BLOW]: {
    // A kit swap after the final attack packet still commits Equalizing Blow's effects.
    interruptCommitMs: 400,
    castTimeMs: 440,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Equalizing Blow',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 8,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 3
      }
    ])
  },
  [ID.POSITIVE_STRIKE]: {
    castTimeMs: 480,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        name: 'Positive Strike',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1
      }
    ])
  },
  [ID.ROCKET_CHARGE]: {
    castTimeMs: 1920,

    cooldown: 12,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 640, coefficient: 1.2 },
          { atMs: 1240, coefficient: 1.2 },
          { atMs: 1920, coefficient: 1.2 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Rocket Charge',
        actorType: 'player'
      }
    ]
  },
  [ID.THUNDERCLAP]: {
    castTimeMs: 520,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Lightning',
        duration: 5,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 4 / 5 })),
          name: 'Thunderclap',
          actorType: 'player'
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 5 }, (_, index) => ({
            atMs: 1000 + index * 1000,
            condition: 'Vulnerability',
            stacks: 1,
            duration: 8
          })),
          actorType: 'player'
        }
      ]),
      {
        type: 'control',
        actorType: 'player',
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'stun'
      }
    ]
  }
});
