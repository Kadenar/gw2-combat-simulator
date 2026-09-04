/** Canonical Core revenant skill fragments grouped by their GW2 owner. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const REVENANT_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FIELD_OF_THE_MISTS]: {
    interruptCommitMs: 0,
    castTimeMs: 750,
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
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1639, coefficient: 3.2 }],
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
        atMs: 1639,
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
    cooldown: 4,
    energyCost: 5,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 561, coefficient: 3.5 }],
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
        ticks: [{ atMs: 1521, coefficient: 3.5 }],
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
    cooldown: 0,
    energyCost: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 481, coefficient: 0.9 }],
        name: 'Hammer Bolt',
        actorType: 'player',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
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
