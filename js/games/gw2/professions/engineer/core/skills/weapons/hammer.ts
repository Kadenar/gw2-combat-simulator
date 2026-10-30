/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Defines Engineer hammer skill timing, damage, control, conditions, boons, and combo behavior. */
export const ENGINEER_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.POSITIVE_STRIKE]: {
    cooldown: 0,
    castTimeMs: 480,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        name: 'Positive Strike',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 1
      }
    ])
  },
  [ID.NEGATIVE_BASH]: {
    cooldown: 0,
    castTimeMs: 640,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Negative Bash',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 8,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.EQUALIZING_BLOW]: {
    cooldown: 0,
    castTimeMs: 440,
    // A kit swap after the final attack packet still commits Equalizing Blow's effects.
    interruptCommitMs: 400,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Equalizing Blow',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 3,
        duration: 8,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 3
      }
    ])
  },
  [ID.ELECTRO_WHIRL]: {
    cooldown: 6,
    castTimeMs: 680,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.WHIRL
      }
    ],
    effects: [
      {
        type: 'strike',
        // Both strikes land before cast recovery ends, matching the observed quickened hit offsets.
        ticks: [280, 640].map((atMs) => ({ atMs, coefficient: 3 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Electro-whirl',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion'
      }
    ]
  },
  [ID.ROCKET_CHARGE]: {
    cooldown: 12,
    castTimeMs: 1920,
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
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.SHOCK_SHIELD]: {
    cooldown: 18,
    castTimeMs: 1200,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 240 + index * 240, coefficient: 1.25 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Shock Shield',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 10,
        duration: 5,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.THUNDERCLAP]: {
    cooldown: 20,
    castTimeMs: 520,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: COMBO_FIELD.LIGHTNING,
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
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 5 }, (_, index) => ({
            atMs: 1000 + index * 1000,
            condition: CONDITION.VULNERABILITY,
            stacks: 1,
            duration: 8
          })),
          actorType: ACTOR.PLAYER
        }
      ]),
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: CONTROL.STUN
      }
    ]
  }
});
