import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const MESMER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CRY_OF_FRUSTRATION]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.core.cry-of-frustration',
      slot: 2,
      kind: 'confusion',
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [0.42, 0.84, 1.25, 1.67],
      effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 3, stacks: 1 }]
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
  [ID.MIND_WRACK]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.core.mind-wrack',
      slot: 1,
      kind: 'power',
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [0.81, 1.61, 2.42, 3.22]
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
  [ID.DISTORTION]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.core.distortion',
      slot: 4,
      kind: 'defense',
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
    effects: []
  },
  [ID.DIVERSION]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.core.diversion',
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
    // The shatter owns its control effect rather than relying on the core CC skill list.
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: 'daze',
        actorType: 'player',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  }
});

// Profile and runtime registries project the same skill-owned recipe.
export const MESMER_CORE_SHATTERS: Readonly<Record<number, MesmerShatterDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_PROFESSION_SKILLS_SKILL_MECHANICS).flatMap(([id, skill]) =>
      skill.shatter ? [[Number(id), skill.shatter as MesmerShatterDefinition]] : []
    )
  )
);
