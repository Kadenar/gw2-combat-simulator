/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.MIND_SLASH]: {
    nextChainId: ID.MIND_GASH,
    castTimeMs: 360,
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
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SWORD.toLowerCase()
      },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5, atMs: 200 }
    ])
  },
  [ID.MIND_GASH]: {
    nextChainId: ID.MIND_SPIKE,
    castTimeMs: 520,
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 280,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SWORD.toLowerCase()
      },
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 1, duration: 5, atMs: 280 }
    ])
  },
  [ID.MIND_SPIKE]: {
    nextChainId: null,
    castTimeMs: 840,
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Mind Spike always receives its boonless-target coefficient.
        coefficient: 2,
        hits: 1,
        atMs: 360,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SWORD.toLowerCase()
      }
    ])
  },
  [ID.BLURRED_FRENZY]: {
    castTimeMs: 960,
    interruptMode: 'per-packet',
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
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SWORD.toLowerCase()
      }
    ])
  },
  [ID.ILLUSIONARY_LEAP]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.SWAP, duration: 5, delay: 0, anchor: 'castStart' },
    resource: {
      mode: 'add',
      count: 1
    },
    castTimeMs: 400,
    interruptCommitMs: 240,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.003,
        hits: 1,
        atMs: 920,
        persistsAfterInterrupt: true,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SWORD.toLowerCase()
      }
    ]),
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }]
  },
  // Flip actions share their parent's catalog so ordinary mechanics assembly owns both faces.
  [ID.SWAP]: {
    rechargeAnchor: 'castStart',
    cooldown: 0,
    castTimeMs: 0,
    comboFinishers: [
      {
        ownerId: 'mesmer',
        finisherType: COMBO_FINISHER.LEAP,
        fieldSelectionAnchor: 'castStart'
      }
    ],
    // Swapping applies immobilize when the instant follow-up completes (wiki: Swap).
    effects: [{ type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }],
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.SWAP } }]
  },
  [ID.BLADE_LEAP]: {
    resource: {
      mode: 'add',
      count: 1
    },
    // Landing deals damage at 800 ms, followed by 200 ms of player aftercast.
    castTimeMs: 1000,
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 800,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SWORD.toLowerCase(),
        // Retain a field crossed during the leap even when it expires before landing.
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: COMBO_FINISHER.LEAP,
            fieldSelectionAnchor: 'castStart'
          }
        ]
      }
    ])
  },
  [ID.ILLUSIONARY_RIPOSTE]: {
    // Flip lifetime follows its parent's authored clock, with delayed readiness kept separate.
    flipArm: { skillId: ID.COUNTER_BLADE, duration: 3, delay: 0, anchor: 'castStart' },
    castTimeMs: 1480,
    defaultInterruptMs: 120,
    interruptCommitMs: 100,
    // No incoming attacks are simulated, so blocking grants neither a clone nor a counterattack.
    effects: [],
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.arm-flip' } }]
  },
  [ID.COUNTER_BLADE]: {
    cooldown: 0,
    castTimeMs: 680,
    effects: [
      // Preserve the flip's existing control timing at cast completion.
      {
        type: 'control',
        source: 'Player',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.1 }],
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SWORD.toLowerCase(),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.COUNTER_BLADE } }]
  },
  [ID.PHANTASMAL_SWORDSMAN]: {
    // The summon owns its attack and conversion timeline independently of the player cast.
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
    phantasmSummonProgress: 720 / 880,
    castTimeMs: 880,
    // Shared interrupt consumers use the fixed cutoff while the custom lifecycle retains the launched phantasm.
    interruptCommitMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Mesmer strike',
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.SWORD.toLowerCase(),
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 840,
        // The attack owns its report label and parent attribution, including repeated attacks.
        name: 'Sword Attack',
        parentSkillName: 'Phantasmal Swordsman',
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
        name: 'Blurred Frenzy',
        parentSkillName: 'Phantasmal Swordsman',
        actorType: ACTOR.SUMMON,
        summonKind: 'phantasm',
        weapon: 'phantasm medium'
      }
    ],
    sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
  }
});
