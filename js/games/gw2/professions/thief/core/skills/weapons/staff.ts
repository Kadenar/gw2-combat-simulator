import { ACTOR, COMBO_FINISHER, CONTROL, WEAPON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WEAKENING_WHIRL]: {
    interruptMode: 'per-packet',
    castTimeMs: 720,
    cooldown: 0,
    initiativeCost: 3,
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
    ]),
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.WHIRL,
        ambiguousFieldSelection: 'oldest'
      }
    ]
  },
  [ID.STAFF_BASH]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
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
  [ID.HOOK_STRIKE]: {
    castTimeMs: 640,
    cooldown: 1,
    initiativeCost: 0,
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
    ],
    requiredMainHand: WEAPON.STAFF,
    stealthAttack: true
  },
  [ID.PUNISHING_STRIKES]: {
    interruptMode: 'per-packet',
    castTimeMs: 760,
    cooldown: 0,
    initiativeCost: 0,
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
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: COMBO_FINISHER.WHIRL,
        ambiguousFieldSelection: 'oldest'
      }
    ]
  },
  [ID.DEBILITATING_ARC]: {
    flipDuration: 3,
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.HELMET_BREAKER } }],
    castTimeMs: 200,
    cooldown: 0,
    initiativeCost: 3,
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
    ])
  },
  [ID.VAULT]: {
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 5,
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
  },
  [ID.STAFF_STRIKE]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
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
  [ID.DUST_STRIKE]: {
    castTimeMs: 520,
    cooldown: 0,
    initiativeCost: 4,
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
  [ID.HELMET_BREAKER]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.HELMET_BREAKER } }],
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 1,
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
    ]
  }
});
