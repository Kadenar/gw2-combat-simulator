/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Packet offsets are rounded independently to the nearest 40 ms tick to avoid cumulative spacing drift.
export const THIEF_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BOLA_SHOT]: {
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 4,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.25 }],
        name: 'Bola Shot',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 5, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Immobilized', stacks: 1, duration: 1.5 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
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
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.3125 }],
        name: 'Shot Damage',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Torment', stacks: 4, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    requiredMainHand: 'Pistol',
    requiredOffHand: 'Dagger'
  },
  [ID.UNLOAD]: {
    quicknessCastTimeMs: 1320,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [80, 200, 280, 400, 480, 600, 680, 760].map((atMs) => ({ // TODO: Need to get actual packet timing
          atMs,
          coefficient: 3.36 / 8
        })),
        name: 'Unload',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
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
        timingScale: 'fixed'
      }
    ]
  },
  [ID.VITAL_SHOT]: {
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.575 }],
        name: 'Vital Shot',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Bleeding', stacks: 1, duration: 6 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.REPEATER]: {
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 3,
    effects: [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, coefficient: 1.5 / 5 })),
        name: 'Repeater (offhand empty)',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
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
    castTimeMs: 500,
    cooldown: 0,
    initiativeCost: 6,
    effects: [
      {
        type: 'strike',
        ticks: [120, 240, 360].map((atMs) => ({ atMs, coefficient: 0.75 / 3 })),
        name: 'Black Powder',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
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
    castTimeMs: 1000,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [120, 280, 400, 560, 680].map((atMs) => ({ atMs, coefficient: 1.8 / 5 })),
        name: 'Sneak Attack',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
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
    castTimeMs: 1250,
    cooldown: 0,
    initiativeCost: 2,
    effects: [
      {
        type: 'strike',
        ticks: [160, 320, 520, 680, 840].map((atMs) => ({ atMs, coefficient: 7.5 / 5 })),
        name: 'Repeater',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
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
