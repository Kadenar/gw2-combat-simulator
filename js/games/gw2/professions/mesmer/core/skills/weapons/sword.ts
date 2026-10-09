import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.MIND_SLASH]: {
    nextChainId: ID.MIND_GASH,
    interruptCommitMs: 240,
    retainsCastLockoutAfterInterrupt: true,
    // Sword's opening hits apply their own vulnerability, independent of the equipped relic.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 200,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      },
      { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5, atMs: 200 }
    ]),
    castTimeMs: 360
  },
  [ID.MIND_GASH]: {
    castTimeMs: 520,
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    nextChainId: ID.MIND_SPIKE,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 280,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      },
      { type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5, atMs: 280 }
    ])
  },
  [ID.MIND_SPIKE]: {
    castTimeMs: 840,
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    nextChainId: null,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Mind Spike always receives its boonless-target coefficient.
        coefficient: 2,
        hits: 1,
        atMs: 360,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ])
  },
  [ID.ILLUSIONARY_LEAP]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.SWAP, duration: 5, delay: 0, anchor: 'castStart' },
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }],
    castTimeMs: 400,
    interruptCommitMs: 240,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.003,
        hits: 1,
        atMs: 920,
        persistsAfterInterrupt: true,
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ])
  },
  [ID.PHANTASMAL_SWORDSMAN]: {
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }],
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmDisplayNames: { 'Phantasm leap': 'Sword Attack', 'Phantasm Blurred Frenzy': 'Blurred Frenzy' },
    phantasmTiming: {
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
    // No incoming attacks are simulated, so blocking grants neither a clone nor a counterattack.
    effects: [],
    castTimeMs: 1480,
    defaultInterruptMs: 120,
    interruptCommitMs: 100
  },
  [ID.BLURRED_FRENZY]: {
    interruptMode: 'per-packet',
    castTimeMs: 960,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // The channel delivers four pairs; interruption keeps only packets already reached.
        ticks: [
          { atMs: 240, coefficient: 0.45 },
          { atMs: 280, coefficient: 0.45 },
          { atMs: 400, coefficient: 0.45 },
          { atMs: 400, coefficient: 0.45 },
          { atMs: 520, coefficient: 0.45 },
          { atMs: 560, coefficient: 0.45 },
          { atMs: 680, coefficient: 0.45 },
          { atMs: 680, coefficient: 0.45 }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword'
      }
    ])
  },
  [ID.BLADE_LEAP]: {
    // Landing deals damage at 800 ms, followed by 200 ms of player aftercast.
    castTimeMs: 1000,
    resource: {
      mode: 'add',
      count: 1
    },
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 800,
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
    ])
  }
});
