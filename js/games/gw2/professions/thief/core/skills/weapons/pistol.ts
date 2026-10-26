import { ACTOR, COMBO_FINISHER, WEAPON, BOON, CONDITION } from '#gw2/platform/constants.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { castRelativeEffectTimingScale } from '#gw2/platform/execution/cast-timing.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

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
    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.DAGGER,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.315 }],
        name: 'Shadow Strike — Packet 1',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
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
        },
        {
          type: 'condition',
          condition: CONDITION.TORMENT,
          stacks: 4,
          duration: 6,
          actorType: ACTOR.PLAYER
        }
      ])
    ],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.REPEATER_ID_59526, durationSec: 4 } }]
  },
  [ID.REPEATER_ID_59526]: {
    cooldown: 0,
    initiativeCost: 2,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.DAGGER,
    castTimeMs: 840,
    effects: [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, coefficient: 7.5 / 5 })),
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
        ticks: [{ atMs: 0, condition: CONDITION.BLEEDING, stacks: 5, duration: 3 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.REPEATER_ID_59526 } }]
  },
  [ID.UNLOAD]: {
    // Intrinsic tuning follows this selected skill at its existing lifecycle boundary.
    initiativeRefund: 2,

    cooldown: 0,
    initiativeCost: 3,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: WEAPON.PISTOL,
    castTimeMs: 1320,
    effects: [
      {
        type: 'strike',
        ticks: [80, 200, 280, 400, 480, 600, 680, 760].map((atMs) => ({
          // TODO: Validate these packet offsets against a combat log.
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
    ],
    // The refund requires the final authored bullet, even when the remaining channel tail is cut short.
    sideEffects: [
      {
        on: 'castCommit',
        when: (_runtime, cast) => {
          const bullets = cast.skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Unload');

          if (bullets?.type !== 'strike') return false;

          const offset = Number(bullets.ticks?.at(-1)?.atMs);
          const scale =
            bullets.timingScale === 'cast'
              ? castRelativeEffectTimingScale(cast.skill, (cast.fullEnd - cast.start) * 1000)
              : 1;
          return Number.isFinite(offset) && cast.effectiveEnd >= canonicalTime(cast.start + (offset * scale) / 1000);
        },
        do: {
          type: 'resourceGrant',
          resource: 'initiative',
          amount: { skillField: 'initiativeRefund' }
        }
      }
    ]
  },
  [ID.REPEATER]: {
    cooldown: 0,
    initiativeCost: 3,
    requiredMainHand: WEAPON.PISTOL,
    requiredOffHand: false,
    castTimeMs: 840,
    effects: [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, coefficient: 1.5 / 5 })),
        name: 'Repeater (offhand empty)',
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
        ticks: [{ atMs: 0, condition: CONDITION.BLEEDING, stacks: 5, duration: 3 }],
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
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
