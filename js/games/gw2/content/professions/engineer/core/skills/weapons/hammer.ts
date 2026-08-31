/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Defines Engineer hammer skill timing, damage, control, conditions, boons, and combo behavior. */
export const ENGINEER_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.NEGATIVE_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Negative Bash',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Vulnerability', stacks: 1, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.SHOCK_SHIELD]: {
    implemented: true,
    castTimeMs: 1750,
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
    implemented: true,
    castTimeMs: 1000,
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
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 340 + index * 340, coefficient: 3 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Electro-whirl',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      }
    ]
  },
  [ID.EQUALIZING_BLOW]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Equalizing Blow',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Vulnerability', stacks: 3, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 3,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.POSITIVE_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Positive Strike',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.ROCKET_CHARGE]: {
    implemented: true,
    castTimeMs: 1920,
    unaffectedByQuickness: true,
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
    implemented: true,
    castTimeMs: 750,
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
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 4 / 5 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
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
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 750,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'stun',
          duration: 1
        }
      }
    ]
  }
});
