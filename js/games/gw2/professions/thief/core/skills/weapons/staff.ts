/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

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
        actorType: 'player'
      },
      {
        type: 'condition',
        // Each connecting hit adds two seconds of weakness at the strike's timestamp.
        ticks: [120, 240, 320].map((atMs) => ({ atMs, condition: 'Weakness', stacks: 1, duration: 2 })),
        actorType: 'player'
      }
    ]),
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
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
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HOOK_STRIKE]: {
    // Custom: Consumes stealth and applies Revealed after the attack; see `core/mechanics/stealth.ts`.
    handlerId: 'thief.stealth-attack',
    castTimeMs: 640,
    cooldown: 1,
    initiativeCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 0.65 }],
        name: 'Hook Strike',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockdown'
      }
    ],
    requiredMainHand: 'Staff',
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
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 0, condition: 'Vulnerability', stacks: 4, duration: 8 }],
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    comboFinishers: [
      {
        ownerId: 'thief',
        finisherType: 'Whirl',
        ambiguousFieldSelection: 'oldest'
      }
    ]
  },
  [ID.DEBILITATING_ARC]: {
    castTimeMs: 200,
    cooldown: 0,
    initiativeCost: 3,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Debilitating Arc',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 6,
        actorType: 'player'
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
        actorType: 'player',
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
        actorType: 'player',
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
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        actorType: 'player',
        duration: 1
      }
    ]
  },
  [ID.HELMET_BREAKER]: {
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 1,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 0, coefficient: 1.25 }],
        name: 'Helmet Breaker',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'daze'
      }
    ]
  }
});
