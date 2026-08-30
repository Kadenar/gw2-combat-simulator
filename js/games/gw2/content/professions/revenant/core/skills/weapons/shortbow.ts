/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const REVENANT_WEAPONS_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BLOODBANE_PATH]: {
    implemented: true,
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
    implemented: true,
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
        coefficient: 0.65,
        hits: 1,
        name: 'Shattershot',
        actorType: 'player',
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'player',
        // Shattershot's Bleeding lands with the projectile on its 400 ms commit frame.
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SCORCHRAZOR]: {
    implemented: true,
    castTimeMs: 520,
    cooldown: 12,
    energyCost: 16,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Scorchrazor',
        actorType: 'player',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'knockdown',
          duration: 2
        }
      }
    ]
  },
  [ID.SEVENSHOT]: {
    implemented: true,
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
    implemented: true,
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
        coefficient: 1.25,
        hits: 1,
        name: 'Initial Damage',
        actorType: 'player',
        atMs: 1320,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 3,
        name: 'Spiritcrush — Fire Field',
        actorType: 'player',
        atMs: 2320,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        applications: 4,
        atMs: 1320,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1.5,
        applications: 4,
        atMs: 1320,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }
});
