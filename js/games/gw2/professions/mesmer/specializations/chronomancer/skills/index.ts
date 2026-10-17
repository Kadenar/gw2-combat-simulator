import { COMBO_FIELD, RECIPIENT, ACTOR, CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
/**
 * Owns Chronomancer well, profession-skill, and Continuum action catalog data.
 * Continuum Split, Time Bomb, and shatter behavior live under `mechanics/` and `traits/`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_CHRONOMANCER_SKILL_MECHANICS: Readonly<Record<SkillId, Partial<MesmerSkill>>> = Object.freeze({
  [ID.WELL_OF_PRECOGNITION]: {
    castTimeMs: 800,
    // Protect allies during the well's three-second lifetime, then refund endurance when it ends.
    comboFields: [{ ownerId: 'mesmer', fieldType: COMBO_FIELD.ETHEREAL, duration: 3, startAnchor: 'castEnd' }],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'boon',
        boon: BOON.AEGIS,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        duration: 3,
        applications: 3,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      // The immediate stun-break stability is personal; the well's later grant protects allies.
      { type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 1, audience: { recipients: RECIPIENT.SELF } },
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'boon',
          boon: BOON.STABILITY,
          stacks: 3,
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          duration: 5,
          atMs: 1000
        },
        {
          type: 'custom',
          eventType: 'resource',
          event: { resource: 'endurance', amount: 30, name: 'Well of Precognition' },
          atMs: 3000
        }
      ])
    ]
  },
  [ID.CONTINUUM_SPLIT]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.chronomancer.continuum-split',
      slot: 5,
      kind: 'continuum',
      resolver: 'mesmer.chronomancer.continuum',
      consumesResources: false,
      resetBySignetOfIllusions: false,
      coefficients: [0, 0, 0, 0],
      durationPerTier: 1.5
    },
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.chronomancer.begin-continuum' } }],
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  },
  [ID.WELL_OF_SENILITY]: {
    castTimeMs: 760,
    effects: [
      {
        type: 'strike',
        coefficient: 4.5,
        hits: 3,
        atMs: 0,
        name: 'Pulse damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      }
    ]
  },
  [ID.WELL_OF_ETERNITY]: {
    castTimeMs: 400,
    effects: []
  },
  [ID.GRAVITY_WELL]: {
    castTimeMs: 1080,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [0, 1000, 2000].map((atMs) => ({ atMs, coefficient: 1.1 })),
        name: 'Pulse damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 2000, coefficient: 2.1 }],
        name: 'Final damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        atMs: 0,
        controlKind: CONTROL.KNOCKDOWN
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        atMs: 1000,
        controlKind: CONTROL.PULL
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        atMs: 2000,
        controlKind: CONTROL.FLOAT
      }
    ])
  },
  [ID.WELL_OF_CALAMITY]: {
    castTimeMs: 800,
    // The well is created on its first observed pulse, so later pulses survive an interrupted cast after that point.
    interruptCommitMs: 560,
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: COMBO_FIELD.ETHEREAL,
        duration: 3,
        startMs: 560,
        startAnchor: 'castStart'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [560, 1560, 2560].map((atMs) => ({ atMs, coefficient: 1.3 })),
        name: 'Pulse damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 3560, coefficient: 2.1 }],
        name: 'Final damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      {
        type: 'condition',
        ticks: [560, 1560, 2560, 3560].map((atMs) => ({
          atMs,
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 2
        }))
      },
      {
        type: 'condition',
        ticks: [560, 1560, 2560, 3560].map((atMs) => ({
          atMs,
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 2
        }))
      }
    ])
  },
  [ID.WELL_OF_ACTION]: {
    // Store the measured Quickness duration so the catalog derives the corresponding base cast consistently.
    castTimeMs: 800,
    // The first pulse commits the well before its animation can be shortened by a shatter or another instant action.
    interruptCommitMs: 520,
    comboFields: [
      {
        ownerId: 'mesmer',
        fieldType: COMBO_FIELD.ETHEREAL,
        duration: 3,
        startMs: 520,
        startAnchor: 'castStart'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 520, coefficient: 1.5 },
          { atMs: 1520, coefficient: 1.5 },
          { atMs: 2520, coefficient: 1.5 }
        ],
        name: 'Pulse damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.TIME_SINK]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.chronomancer.time-sink',
      slot: 3,
      kind: 'control',
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [0, 0, 0, 0]
    },
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: CONTROL.DAZE,
        actorType: ACTOR.PLAYER,
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      { type: 'condition', condition: CONDITION.SLOW, stacks: 1, duration: 2 }
    ]
  },
  [ID.REWINDER]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.chronomancer.rewinder',
      slot: 2,
      kind: CONDITION.CONFUSION.toLowerCase(),
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [0.38, 0.76, 1.14, 1.52],
      rechargeReductionPerSource: 3,
      effects: [
        { name: CONDITION.CONFUSION, type: 'condition', condition: CONDITION.CONFUSION, duration: 3, stacks: 1 }
      ]
    },
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  },
  [ID.SPLIT_SECOND]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.chronomancer.split-second',
      slot: 1,
      kind: 'power',
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [1.53, 3.07, 3.68, 4.3],
      // Each resource tier owns both Split Second packets and their full formulas.
      ticks: [1.53, 3.07, 3.68, 4.3].map((coefficient) => [
        { atMs: 0, coefficient: coefficient / 2 },
        { atMs: 1000, coefficient: coefficient / 2 }
      ])
    },
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    effects: []
  }
});

export const MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<SkillId, Partial<MesmerSkill>>> =
  Object.freeze({});

export const MESMER_CHRONOMANCER_EXTRA_SKILLS: readonly MesmerSkill[] = Object.freeze([
  {
    id: ID.CONTINUUM_SHIFT,
    name: 'Continuum Shift',
    // The return face occupies the same profession control as Continuum Split.
    inputControl: 'profession-5',
    description: 'End Continuum Split early and restore the cooldown state captured when the split began.',
    icon: 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    specialization: 'Chronomancer',
    // Manual Continuum Shift restores the captured state when the action completes.
    tasks: [
      {
        type: 'mesmer.chronomancer.restore-continuum',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
  }
] satisfies readonly MesmerSkill[]);

// Profile and runtime registries project the same skill-owned recipe.
export const MESMER_CHRONOMANCER_SHATTERS: Readonly<Record<number, MesmerShatterDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_CHRONOMANCER_SKILL_MECHANICS).flatMap(([id, skill]) =>
      skill.shatter ? [[Number(id), skill.shatter]] : []
    )
  )
);
