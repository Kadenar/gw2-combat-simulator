import { ACTOR, COMBO_FINISHER, WEAPON, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Both Repeater variants fire the same volley; their weapon access, initiative cost, and charge gate are separate.
const REPEATER_ATTACK = {
  castTimeMs: 1000,
  interruptMode: 'per-packet',
  effects: [
    {
      type: 'strike',
      // Three EVTC volleys agree on these rounded impact offsets, including bullets arriving after the channel.
      ticks: [600, 760, 960, 1120, 1280].map((atMs) => ({ atMs, coefficient: 7.5 / 5 })),
      name: 'Repeater',
      actorType: ACTOR.PLAYER,
      timingAnchor: 'castStart',
      timingScale: 'cast',
      comboFinishers: [
        {
          ownerId: 'thief',
          finisherType: COMBO_FINISHER.PROJECTILE,
          chance: 0.2
        }
      ]
    },
    {
      type: 'condition',
      // Bleeding belongs to each landed projectile rather than a batch granted when the channel ends.
      ticks: [600, 760, 960, 1120, 1280].map((atMs) => ({
        atMs,
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 3
      })),
      actorType: ACTOR.PLAYER,
      timingAnchor: 'castStart',
      timingScale: 'cast'
    }
  ]
} satisfies Pick<Skill, 'castTimeMs' | 'interruptMode' | 'effects'>;

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.VITAL_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.575,
        hits: 1,
        name: 'Vital Shot',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SNEAK_ATTACK]: {
    cooldown: 1,
    initiativeCost: 0,
    requiredMainHand: WEAPON.PISTOL,
    stealthAttack: true,
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 1.8 / 5 })),
        name: 'Sneak Attack',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: CONDITION.BLEEDING, stacks: 5, duration: 5 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BOLA_SHOT]: {
    cooldown: 0,
    initiativeCost: 4,
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Bola Shot',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 1.5,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SHADOW_STRIKE]: {
    // The retreat shadowsteps away, enabling shared shadowstep rewards such as Peitha.
    shadowstepSkill: true,
    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.DAGGER,
    // EVTC records a 160 ms melee segment followed by a 440 ms shot animation: 600 ms on the action grid.
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 160, coefficient: 0.315 }],
        name: 'Shadow Strike — Packet 1',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      ...impactEffects({ atMs: 240, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.3125,
          hits: 1,
          name: 'Shot Damage',
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        }
      ]),
      {
        // The supplied EVTC applies torment with the melee hit, before the retreating shot arrives.
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 4,
        duration: 6,
        actorType: ACTOR.PLAYER,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // PvE grants three Repeater uses sharing a ten-second window; spending a use does not refresh it.
    sideEffects: [
      { on: 'castCommit', do: { type: 'flipArm', skillId: ID.REPEATER_ID_59526, durationSec: 10, uses: 3 } }
    ]
  },
  [ID.REPEATER_ID_59526]: {
    cooldown: 0,
    initiativeCost: 2,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.DAGGER,
    ...REPEATER_ATTACK,
    // Activation spends one charge even if interrupted; only depletion or expiry restores Shadow Strike.
    sideEffects: [{ on: 'castStart', do: { type: 'flipConsume', skillId: ID.REPEATER_ID_59526 } }]
  },
  [ID.UNLOAD]: {
    // The channel refund mechanic grants this only after every bullet in the activation lands.
    initiativeRefund: 2,

    cooldown: 0,
    initiativeCost: 3,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.PISTOL,
    castTimeMs: 1320,
    // Interrupting the volley preserves bullets already fired and cancels the remaining packets.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        // EVTC hit offsets rounded independently to 40 ms keep the observed alternating shot spacing.
        ticks: [240, 400, 480, 640, 720, 880, 960, 1120].map((atMs) => ({
          atMs,
          coefficient: 3.36 / 8
        })),
        name: 'Unload',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 8
      }
    ]
  },
  [ID.REPEATER]: {
    cooldown: 0,
    initiativeCost: 3,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: false,
    ...REPEATER_ATTACK
  },
  [ID.HEAD_SHOT]: {
    cooldown: 0,
    initiativeCost: 4,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Head Shot',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      }
    ]
  },
  [ID.BLACK_POWDER]: {
    cooldown: 0,
    initiativeCost: 6,
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [120, 240, 360].map((atMs) => ({ atMs, coefficient: 0.75 / 3 })),
        name: 'Black Powder',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER,
        applications: 3,
        atMs: 0,
        intervalMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
