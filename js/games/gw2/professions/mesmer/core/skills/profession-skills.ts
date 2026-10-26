import { shatterSkill } from '#gw2/professions/mesmer/core/skills/shatter.js';
import { CONTROL, ACTOR, CONDITION } from '#gw2/platform/constants.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
/** Canonical Core mesmer skill fragments grouped by their GW2 owner. */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

export const MESMER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, Partial<MesmerSkill>>> = Object.freeze({
  [ID.CRY_OF_FRUSTRATION]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 2,
      kind: CONDITION.CONFUSION.toLowerCase(),
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [0.42, 0.84, 1.25, 1.67],
      effects: [
        { name: CONDITION.CONFUSION, type: 'condition', condition: CONDITION.CONFUSION, duration: 3, stacks: 1 }
      ]
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    effects: []
  },
  [ID.MIND_WRACK]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 1,
      kind: 'power',
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [0.81, 1.61, 2.42, 3.22]
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    effects: []
  },
  [ID.DISTORTION]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 4,
      kind: 'defense',
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [0, 0, 0, 0]
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    effects: []
  },
  [ID.DIVERSION]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 3,
      kind: 'control',
      resolver: 'mesmer.core.clone-shatter',
      coefficients: [0, 0, 0, 0]
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    castTimeMs: 0,
    // The shatter owns its control effect rather than relying on the core CC skill list.
    effects: [
      {
        type: 'control',
        source: 'Player',
        controlKind: CONTROL.DAZE,
        actorType: ACTOR.PLAYER,
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
      skill.shatter ? [[Number(id), skill.shatter]] : []
    )
  )
);
