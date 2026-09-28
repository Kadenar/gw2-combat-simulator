import type { Skill } from '#gw2/platform/engine/skills/types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

export const MESMER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PHANTASMAL_LANCER]: {
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.consume-clarity' } },
      { on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }
    ],
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      castTimeMs: 520,
      // Clarity agents spawn together, but their observed attacks/conversions can stagger:
      // representative per-entity offsets were damage [920, 1200] and conversion [1760, 2040].
      // Keep the single-Lancer profile until exact shatter-window fidelity needs a Clarity-only override.
      damageAtMs: 1160,
      spawnAtMs: 2040,
      // The trait blade lands about one second after the Lancer's javelin hit.
      phantasmalBladeDelayAfterSpawnMs: 120
    },
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mesmer attack',
        actorType: 'player',
        weapon: 'spear'
      },
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'One lancer',
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
        type: 'condition',
        condition: 'Crippled',
        duration: 3,
        stacks: 1,
        actorType: 'summon',
        summonKind: 'phantasm',
        phantasmEntityIndex: 0
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        duration: 2,
        stacks: 1,
        actorType: 'summon',
        summonKind: 'phantasm',
        phantasmEntityIndex: 1
      }
    ],
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1,
      clarityCount: 2
    }
  },
  [ID.MENTAL_COLLAPSE]: {
    // A committed cast resets Mind the Gap even when the remaining animation is interrupted.
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.consume-clarity' } },
      { on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.MIND_THE_GAP] } }
    ],
    shadowstepSkill: true,
    peithaImpactDelayMs: 800,
    castTimeMs: 640,
    // Preserve the impact when interruption only skips the remaining recovery.
    interruptCommitMs: 600,
    effects: [
      {
        // Only the initial impact stuns when this activation consumed Clarity.
        type: 'control',
        source: 'Player',
        controlKind: 'stun',
        actorType: 'player',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        when: (runtime, cast) =>
          Boolean(mesmerMechanicsFor(runtime as MesmerRuntime).castDetails.get(cast.id)?.clarityConsumed)
      },
      {
        type: 'strike',
        // The initial impact precedes recovery; the two follow-up hits resolve afterward.
        ticks: [
          { atMs: 560, coefficient: 1 },
          { atMs: 840, coefficient: 1 },
          { atMs: 1120, coefficient: 1 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear',
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      }
    ]
  },
  [ID.PSYSTRIKE]: {
    castTimeMs: 520,
    interruptCommitMs: 480,
    nextChainId: ID.MIND_PIERCE,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ]
  },
  [ID.MIND_THE_GAP]: {
    // Clarity is granted at commitment while damage keeps its independent packet timestamp.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.grant-clarity' } }],
    castTimeMs: 600,
    // Committed interrupts preserve the attack while its full cast still occupies the casting lane.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    // The impact uses the next action tick after 480 ms so a just-prior shatter cannot consume this clone.
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 520
    },
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Outer-edge damage',
        actorType: 'player',
        weapon: 'spear',
        // The impact lands before the retained aftercast, alongside the clone gain.
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        // Mind the Gap owns the Clarity grant; a committed interruption retains its completion-time buff.
        type: 'buff',
        kind: 'clarity',
        name: 'Clarity',
        duration: 15,
        icon: 'https://wiki.guildwars2.com/wiki/Special:FilePath/Clarity.png',
        audience: { recipients: 'self' },
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.MIND_PIERCE]: {
    castTimeMs: 560,
    // Preserve the finisher's damage when interruption only skips the remaining recovery.
    interruptCommitMs: 400,
    nextChainId: null,
    // The chain finisher's strike and Weakness share an impact before cast recovery ends.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 2
      }
    ])
  },
  [ID.IMAGINARY_INVERSION]: {
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.consume-clarity' } }],
    castTimeMs: 680,
    interruptCommitMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.4 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PSYCUT]: {
    // The attack commits before its full cast animation finishes.
    interruptCommitMs: 400,
    nextChainId: ID.PSYSTRIKE,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        // Resolve the hit before the remaining cast recovery.
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: 'player',
        weapon: 'spear'
      }
    ],
    castTimeMs: 400
  }
});
