/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const REVENANT_WEAPONS_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BLOODBANE_PATH]: {
    interruptMode: 'per-packet',
    castTimeMs: 760,
    unaffectedByQuickness: true,
    cooldown: 3,
    energyCost: 4,
    effects: [
      {
        type: 'strike',
        name: 'Bloodbane Path',
        actorType: 'player',
        ticks: [
          { atMs: 600, coefficient: 0.4 },
          { atMs: 720, coefficient: 0.4 },
          { atMs: 840, coefficient: 0.4 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.SHATTERSHOT]: {
    castTimeMs: 480,
    unaffectedByQuickness: true,
    interruptCommitMs: 400,
    cooldown: 0,
    energyCost: 0,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 0.65 }],
        name: 'Shattershot',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        // Shattershot's Bleeding lands with the projectile on its 400 ms commit frame.
        ticks: [{ atMs: 400, condition: 'Bleeding', stacks: 1, duration: 3 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SCORCHRAZOR]: {
    castTimeMs: 520,
    cooldown: 12,
    energyCost: 16,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1 }],
        name: 'Scorchrazor',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Burning', stacks: 1, duration: 4 }],
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'knockdown',
        duration: 2
      }
    ]
  },
  [ID.SEVENSHOT]: {
    castTimeMs: 440,
    unaffectedByQuickness: true,
    cooldown: 7,
    energyCost: 7,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        name: 'Sevenshot',
        actorType: 'player',
        ticks: [
          { atMs: 0, coefficient: 0.31 },
          { atMs: 160, coefficient: 0.31 },
          { atMs: 200, coefficient: 0.31 },
          { atMs: 360, coefficient: 0.31 },
          { atMs: 400, coefficient: 0.31 },
          { atMs: 600, coefficient: 0.31 },
          { atMs: 600, coefficient: 0.31 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        actorType: 'player',
        ticks: [
          { atMs: 0, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 160, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 200, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 360, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 400, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 600, condition: 'Torment', stacks: 1, duration: 4 },
          { atMs: 600, condition: 'Torment', stacks: 1, duration: 4 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SPIRITCRUSH]: {
    castTimeMs: 400,
    unaffectedByQuickness: true,
    cooldown: 9,
    energyCost: 12,
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: 'Fire',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1320, coefficient: 1.25 }],
        name: 'Initial Damage',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 3 }, (_, index) => ({ atMs: 2320 + index * 1000, coefficient: 0.75 / 3 })),
        name: 'Spiritcrush — Fire Field',
        actorType: 'player',
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 1320 + index * 1000,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 4 }, (_, index) => ({
          atMs: 1320 + index * 1000,
          condition: 'Slow',
          stacks: 1,
          duration: 1.5
        })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }
});
