/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HOOK_STRIKE]: {
    cooldown: 1,
    initiativeCost: 0,
    requiredMainHand: WEAPON.STAFF,
    stealthAttack: true,
    castTimeMs: 640,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.65 }],
        name: 'Hook Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      }
    ]
  },
  [ID.STAFF_STRIKE]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.85 }],
        name: 'Staff Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STAFF_BASH]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.9 }],
        name: 'Staff Bash',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PUNISHING_STRIKES]: {
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 760,
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.WHIRL
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680].map((atMs) => ({
          atMs,
          coefficient: 2.1 / 4
        })),
        name: 'Punishing Strikes',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.VULNERABILITY, stacks: 4, duration: 8 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.WEAKENING_WHIRL]: {
    cooldown: 0,
    initiativeCost: 3,
    castTimeMs: 720,
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.WHIRL
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [120, 240, 320].map((atMs) => ({
          atMs,
          coefficient: 2.22 / 3
        })),
        name: 'Weakening Whirl',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        // Each connecting hit adds two seconds of weakness at the strike's timestamp.
        ticks: [120, 240, 320].map((atMs) => ({ atMs, condition: CONDITION.WEAKNESS, stacks: 1, duration: 2 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.DEBILITATING_ARC]: {
    flipDuration: 3,
    cooldown: 0,
    initiativeCost: 3,
    castTimeMs: 200,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Debilitating Arc',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ]),
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.HELMET_BREAKER } }]
  },
  [ID.HELMET_BREAKER]: {
    cooldown: 0,
    initiativeCost: 1,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.25 }],
        name: 'Helmet Breaker',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.DAZE
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.HELMET_BREAKER } }]
  },
  [ID.DUST_STRIKE]: {
    cooldown: 0,
    initiativeCost: 4,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520].map((atMs) => ({
          atMs,
          coefficient: 1.8 / 3
        })),
        name: 'Dust Strike',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.VAULT]: {
    // The leap is a movement skill for movement-triggered rewards.
    movementSkill: true,
    cooldown: 0,
    initiativeCost: 5,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 2.25 }],
        name: 'Vault',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  }
});
