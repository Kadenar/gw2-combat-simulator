import { ACTOR, COMBO_FINISHER, CONTROL, COMBO_FIELD, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

export const REVENANT_WEAPONS_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BLOODBANE_PATH]: {
    interruptMode: 'per-packet',
    castTimeMs: 760,
    cooldown: 3,
    energyCost: 4,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Bloodbane Path',
        actorType: ACTOR.PLAYER,
        ticks: [600, 720, 840].map((atMs) => ({ atMs, coefficient: 0.4 }))
      },
      {
        type: 'condition',
        // Each Bloodbane projectile owns its Bleeding so partial casts retain only landed packets.
        ticks: [600, 720, 840].map((atMs) => ({ atMs, condition: CONDITION.BLEEDING, stacks: 1, duration: 6 })),
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.SHATTERSHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 480,
    interruptCommitMs: 400,
    cooldown: 0,
    energyCost: 0,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.65,
          hits: 1,
          name: 'Shattershot',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          // Shattershot's Bleeding lands with the projectile on its 400 ms commit frame.
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]
    )
  },
  [ID.SCORCHRAZOR]: {
    castTimeMs: 360,
    cooldown: 12,
    energyCost: 16,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Scorchrazor',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      }
    ])
  },
  [ID.SEVENSHOT]: {
    castTimeMs: 440,
    // Once the volley releases, its projectiles keep traveling after the remaining animation is interrupted.
    interruptCommitMs: 400,
    cooldown: 7,
    energyCost: 7,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        name: 'Sevenshot',
        actorType: ACTOR.PLAYER,
        ticks: [0, 160, 200, 360, 400, 600, 600].map((atMs) => ({ atMs, coefficient: 0.31 }))
      },
      {
        type: 'condition',
        actorType: ACTOR.PLAYER,
        ticks: [0, 160, 200, 360, 400, 600, 600].map((atMs) => ({
          atMs,
          condition: CONDITION.TORMENT,
          stacks: 1,
          duration: 4
        }))
      }
    ])
  },
  [ID.SPIRITCRUSH]: {
    castTimeMs: 400,

    cooldown: 9,
    energyCost: 12,
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: COMBO_FIELD.FIRE,
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 1320, coefficient: 1.25 }],
        name: 'Initial Damage',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 2320 + index * 1000, coefficient: 0.75 / 3 })),
        name: 'Spiritcrush — Fire Field',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 1320 + index * 1000,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 3
        })),
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 1320 + index * 1000,
          condition: CONDITION.SLOW,
          stacks: 1,
          duration: 1.5
        })),
        actorType: ACTOR.PLAYER
      }
    ])
  }
});
