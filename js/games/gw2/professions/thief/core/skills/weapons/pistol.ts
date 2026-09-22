/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
// Share each impact's timing while preserving effect order and effect-local payloads.
export const THIEF_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BOLA_SHOT]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1,
        name: 'Bola Shot',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1.5,
        actorType: 'player'
      }
    ])
  },
  [ID.SHADOW_STRIKE]: {
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.315 }],
        name: 'Shadow Strike — Packet 1',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.3125,
          hits: 1,
          name: 'Shot Damage',
          actorType: 'player',
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        {
          type: 'condition',
          condition: 'Torment',
          stacks: 4,
          duration: 6,
          actorType: 'player'
        }
      ])
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Dagger'
  },
  [ID.UNLOAD]: {
    castTimeMs: 1320,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [80, 200, 280, 400, 480, 600, 680, 760].map((atMs) => ({
          // TODO: Need to get actual packet timing
          atMs,
          coefficient: 3.36 / 8
        })),
        name: 'Unload',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 8
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Pistol'
  },
  [ID.HEAD_SHOT]: {
    castTimeMs: 0,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1 }],
        name: 'Head Shot',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      }
    ]
  },
  [ID.VITAL_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.575,
        hits: 1,
        name: 'Vital Shot',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ])
  },
  [ID.REPEATER]: {
    castTimeMs: 840,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, coefficient: 1.5 / 5 })),
        name: 'Repeater (offhand empty)',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 5, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: false
  },
  [ID.BLACK_POWDER]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 6,
    effects: [
      {
        type: 'strike',
        ticks: [120, 240, 360].map((atMs) => ({ atMs, coefficient: 0.75 / 3 })),
        name: 'Black Powder',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'blind',
        actorType: 'player',
        applications: 3,
        atMs: 0,
        intervalMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SNEAK_ATTACK]: {
    // Custom: Consumes stealth and applies Revealed after the attack; see `core/mechanics/stealth.ts`.
    handlerId: 'thief.stealth-attack',
    castTimeMs: 680,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 1.8 / 5 })),
        name: 'Sneak Attack',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 5, duration: 5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Pistol',
    stealthAttack: true
  },
  [ID.REPEATER_ID_59526]: {
    castTimeMs: 840,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, coefficient: 7.5 / 5 })),
        name: 'Repeater',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'thief',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 5, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Dagger'
  }
});
