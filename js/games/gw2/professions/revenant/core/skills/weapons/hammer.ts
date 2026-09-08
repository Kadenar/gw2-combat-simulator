/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Snap measured impact offsets to 40 ms action ticks instead of retaining EVTC timestamp jitter.
export const REVENANT_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FIELD_OF_THE_MISTS]: {
    interruptCommitMs: 0,
    castTimeMs: 750,
    // Measured Quickness animations include recovery time beyond the tooltip cast.
    quicknessCastTimeMs: 600,
    cooldown: 12,
    energyCost: 10,
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: 'Dark',
        duration: 6,
        startMs: 560,
        startAnchor: 'castStart'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1.8 }],
        name: 'Field of the Mists',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {},
        comboFinishers: [
          {
            ownerId: 'revenant',
            finisherType: 'Projectile',
            chance: 1,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.PHASE_SMASH]: {
    castTimeMs: 1250,
    cooldown: 8,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 2.22,
        hits: 1,
        name: 'Phase Smash',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'revenant',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      }
    ]
  },
  [ID.DROP_THE_HAMMER]: {
    interruptCommitMs: 0,
    castTimeMs: 500,
    quicknessCastTimeMs: 480,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1640, coefficient: 3.2 }],
        name: 'Drop the Hammer',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {},
        comboFinishers: [
          {
            ownerId: 'revenant',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'control',
        actorType: 'player',
        atMs: 1640,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        controlKind: 'knockdown',
        duration: 3
      }
    ]
  },
  [ID.COALESCENCE_OF_RUIN]: {
    interruptCommitMs: 0,
    castTimeMs: 750,
    quicknessCastTimeMs: 720,
    cooldown: 4,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        // Each cascade region uses the same 2.3 PvE coefficient, including repeat hits on large targets.
        ticks: [{ atMs: 560, coefficient: 2.3 }],
        name: 'Coalescence of Ruin',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      },
      {
        // Large targets intersect a second cascade region about 0.96 seconds after the first impact.
        type: 'strike',
        ticks: [{ atMs: 1520, coefficient: 2.3 }],
        name: 'Coalescence of Ruin',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: { largeHitboxOnly: true }
      }
    ]
  },
  [ID.HAMMER_BOLT]: {
    castTimeMs: 750,
    quicknessCastTimeMs: 560,
    // The projectile launches around 440 ms; cancelling recovery cannot recall it.
    interruptCommitMs: 440,
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.9 }],
        name: 'Hammer Bolt',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: 'revenant',
            finisherType: 'Projectile',
            chance: 1,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ]
  }
});
