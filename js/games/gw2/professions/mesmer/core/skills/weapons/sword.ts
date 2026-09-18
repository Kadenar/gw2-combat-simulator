/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const MESMER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MIND_SLASH]: {
    nextChainId: ID.MIND_GASH,
    // Sword's opening hits apply their own vulnerability, independent of the equipped relic.
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      },
      { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5 }
    ],
    castTimeMs: 360
  },
  [ID.MIND_GASH]: {
    castTimeMs: 520,
    nextChainId: ID.MIND_SPIKE,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      },
      { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5 }
    ]
  },
  [ID.MIND_SPIKE]: {
    castTimeMs: 840,
    boonlessCoefficient: 2,
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ]
  },
  [ID.ILLUSIONARY_LEAP]: {
    castTimeMs: 400,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 0.003,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ]
  },
  [ID.PHANTASMAL_SWORDSMAN]: {
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1
    },
    // Shared interrupt consumers use the fixed cutoff while the custom lifecycle retains the launched phantasm.
    interruptCommitMs: 720,
    phantasmSummonProgress: 720 / 880,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Mesmer strike',
        actorType: 'player',
        weapon: 'sword',
        castProgress: 0.8625
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 840,
        name: 'Phantasm leap',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium',
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'strike',
        ticks: [
          { atMs: 1320, coefficient: 0.2 },
          { atMs: 1360, coefficient: 0.2 },
          { atMs: 1640, coefficient: 0.2 },
          { atMs: 1680, coefficient: 0.2 },
          { atMs: 1920, coefficient: 0.2 },
          { atMs: 1960, coefficient: 0.2 },
          { atMs: 2240, coefficient: 0.2 },
          { atMs: 2280, coefficient: 0.2 }
        ],
        name: 'Phantasm Blurred Frenzy',
        actorType: 'summon',
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    castTimeMs: 880
  },
  [ID.ILLUSIONARY_RIPOSTE]: {
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ],
    castTimeMs: 1480,
    defaultInterruptMs: 120,
    interruptCommitMs: 100
  },
  [ID.BLURRED_FRENZY]: {
    interruptMode: 'per-packet',
    castTimeMs: 960,
    effects: [
      {
        type: 'strike',
        coefficient: 3.6,
        hits: 8,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ]
  },
  [ID.BLADE_LEAP]: {
    castTimeMs: 500,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword',
        // Retain a field crossed during the leap even when it expires before landing.
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: 'Leap',
            fieldSelectionAnchor: 'castStart',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ]
  }
});
