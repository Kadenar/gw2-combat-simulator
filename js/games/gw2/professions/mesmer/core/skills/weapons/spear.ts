/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

export const MESMER_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.PSYCUT]: {
    nextChainId: ID.PSYSTRIKE,
    castTimeMs: 400,
    // Landing Psycut advances the chain even when its remaining recovery is cancelled.
    interruptCommitMs: 360,
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
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SPEAR.toLowerCase()
      }
    ]
  },
  [ID.PSYSTRIKE]: {
    nextChainId: ID.MIND_PIERCE,
    castTimeMs: 520,
    // Preserve the landed strike and chain advance when recovery is interrupted at 440 ms.
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SPEAR.toLowerCase()
      }
    ]
  },
  [ID.MIND_PIERCE]: {
    nextChainId: null,
    castTimeMs: 560,
    // Preserve the finisher's damage when interruption only skips the remaining recovery.
    interruptCommitMs: 400,
    // The chain finisher's strike and Weakness share an impact before cast recovery ends.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SPEAR.toLowerCase()
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 2
      }
    ])
  },
  [ID.MIND_THE_GAP]: {
    // The impact uses the next action tick after 480 ms so a just-prior shatter cannot consume this clone.
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 520
    },
    castTimeMs: 600,
    // Committed interrupts preserve the attack while its full cast still occupies the casting lane.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        name: 'Outer-edge damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SPEAR.toLowerCase(),
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
        icon: new URL('@images/wiki/clarity.png', import.meta.url).href,
        audience: { recipients: RECIPIENT.SELF },
        persistsAfterInterrupt: true
      }
    ],
    // Clarity is granted at commitment while damage keeps its independent packet timestamp.
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.grant-clarity' } }]
  },
  [ID.IMAGINARY_INVERSION]: {
    castTimeMs: 680,
    interruptCommitMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2.4 }],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SPEAR.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.consume-clarity' } }]
  },
  [ID.PHANTASMAL_LANCER]: {
    // The summon owns its attack and conversion timeline independently of the player cast.
    phantasmTiming: {
      // Clarity agents spawn together, but their observed attacks/conversions can stagger:
      // representative per-entity offsets were damage [920, 1200] and conversion [1760, 2040].
      // Keep the single-Lancer profile until exact shatter-window fidelity needs a Clarity-only override.
      damageAtMs: 1160,
      spawnAtMs: 2040,
      // The trait blade lands about one second after the Lancer's javelin hit.
      phantasmalBladeDelayAfterSpawnMs: 120
    },
    phantasm: true,
    resource: {
      mode: 'phantasm',
      count: 1,
      clarityCount: 2
    },
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Mesmer attack',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SPEAR.toLowerCase()
      },
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        name: 'One lancer',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm medium',
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        duration: 3,
        stacks: 1,
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        phantasmEntityIndex: 0
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        duration: 2,
        stacks: 1,
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        phantasmEntityIndex: 1
      }
    ],
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.consume-clarity' } },
      { on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }
    ]
  },
  [ID.MENTAL_COLLAPSE]: {
    shadowstepSkill: true,
    peithaImpactDelayMs: 800,
    castTimeMs: 640,
    interruptCommitMs: 600,
    effects: [
      {
        // Only the initial impact stuns when this activation consumed Clarity.
        type: 'control',
        source: 'Player',
        controlKind: CONTROL.STUN,
        actorType: ACTOR.PLAYER,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        when: (runtime: MechanicQueryContext<MesmerRuntimeState>, cast) =>
          Boolean(runtime.profession.core.castDetails.get(cast.id)?.clarityConsumed)
      },
      {
        type: 'strike',
        // Once committed, all three impacts survive interruption of the remaining recovery.
        persistsAfterInterrupt: true,
        ticks: [
          { atMs: 560, coefficient: 1 },
          { atMs: 840, coefficient: 1 },
          { atMs: 1120, coefficient: 1 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SPEAR.toLowerCase(),
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      }
    ],
    // A committed cast resets Mind the Gap even when the remaining animation is interrupted.
    sideEffects: [
      { on: 'castStart', do: { type: 'mesmer.consume-clarity' } },
      { on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.MIND_THE_GAP] } }
    ]
  }
});
