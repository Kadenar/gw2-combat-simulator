import type { Skill } from '#gw2/platform/engine/skills/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
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
    nextChainId: null,
    effects: [
      {
        type: 'strike',
        // Mind Spike always receives its boonless-target coefficient.
        coefficient: 2,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ]
  },
  [ID.ILLUSIONARY_LEAP]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.SWAP, duration: 5, delay: 0, anchor: 'castStart' },
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }],
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
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }],
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmDisplayNames: { 'Phantasm leap': 'Sword Attack', 'Phantasm Blurred Frenzy': 'Blurred Frenzy' },
    phantasmTiming: {
      castTimeMs: 880,
      damageAtMs: 2280,
      // The supplied power-Chrono lifecycle converts Swordsman at a 3.41s median after its cast completes.
      spawnAtMs: 3410,
      phantasmalBladeDelayAfterSpawnMs: 83
    },
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
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.COUNTER_BLADE, duration: 3, delay: 0, anchor: 'castStart' },
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }],
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
