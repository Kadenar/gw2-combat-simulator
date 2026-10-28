/**
 * Owns Virtuoso dagger, slot-skill, and bladesong catalog fragments.
 * Blade storage and bladesong runtime behavior lives under `mechanics/`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { shatterSkill } from '#gw2/professions/mesmer/core/skills/shatter.js';
import { bladecallEffects } from '#gw2/professions/mesmer/core/skills/weapons/bladecall.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/**
 * Builds each blade tier's timed packets from its total strike coefficient.
 * `coefficients` remains the tier total used by shared shatter profiles, while
 * `ticks` distributes that total across the packets' individual impact times.
 */
function bladePacketTiers(coefficients: readonly number[], atMs: readonly number[]) {
  return coefficients.map((coefficient, spent) =>
    atMs.slice(0, spent).map((packetAtMs) => ({ atMs: packetAtMs, coefficient: coefficient / spent }))
  );
}

export const MESMER_VIRTUOSO_SKILL_MECHANICS: Readonly<Record<SkillId, Partial<MesmerSkill>>> = Object.freeze({
  [ID.BLADECALL]: {
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 200
    },
    blade: true,
    castTimeMs: 440,
    // Commit when the daggers launch so their persistent packets and blade gain share the same successful cast.
    interruptCommitMs: 200,
    retainsCastLockoutAfterInterrupt: true,
    effects: bladecallEffects()
  },
  [ID.THOUSAND_CUTS]: {
    blade: true,
    castTimeMs: 0,
    // The portal delivers ten equal impacts at a fixed cadence after its startup delay.
    effects: Array.from({ length: 10 }, (_, index) => 560 + index * 520).flatMap((atMs) =>
      impactEffects({ atMs, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.5,
          hits: 1,
          actorType: ACTOR.PLAYER,
          weapon: 'unequipped'
        }
      ])
    )
  },
  [ID.SWORD_OF_DECIMATION]: {
    blade: true,
    // Resolve the strike after the reviewed activation duration.
    castTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: 'utility'
      },
      // The falling blade immobilizes at the same impact as its strike (wiki: Sword_of_Decimation, PvE).
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 4 }
    ]
  },
  [ID.BLADE_RENEWAL]: {
    resource: {
      mode: 'fill',
      count: 5
    },
    blade: true,
    // Fill stored blades only after the reviewed channel completes.
    castTimeMs: 2040,
    effects: []
  },
  [ID.RAIN_OF_SWORDS]: {
    blade: true,
    castTimeMs: 680,
    // Each delayed pulse owns its strike and vulnerability together so they share the same impact timing.
    effects: Array.from({ length: 5 }, (_, index) => 840 + index * 1000).flatMap((atMs) =>
      impactEffects({ atMs, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.2,
          hits: 1,
          actorType: ACTOR.PLAYER,
          weapon: 'utility'
        },
        { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 3, duration: 10 }
      ])
    )
  },
  [ID.TWIN_BLADE_RESTORATION]: {
    blade: true,
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: ACTOR.PLAYER,
        weapon: 'unequipped'
      }
    ]
  },
  [ID.BLADETURN_REQUIEM]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 5,
      kind: 'blade-requiem',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.5, 1, 1.5, 2, 2.5],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.5, 1, 1.5, 2, 2.5], [1000, 2000, 3000, 4000, 5000])
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.BLADESONG_DISSONANCE]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 3,
      kind: 'blade-control',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 1, 1, 1, 1, 1],
      minimumResource: 1,
      resourceSpendProgress: 1,
      damageAtMs: 400
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    castTimeMs: 480,
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
  },
  [ID.BLADESONG_SORROW]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 2,
      kind: 'blade-confusion',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.42, 0.84, 1.25, 1.67, 2.09],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.42, 0.84, 1.25, 1.67, 2.09], [440, 520, 600, 680, 680]),
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
    blade: true,
    castTimeMs: 480,
    effects: []
  },
  [ID.BLADESONG_HARMONY]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 1,
      kind: 'blade-power',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.7, 1.4, 2.1, 2.8, 3.5],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.7, 1.4, 2.1, 2.8, 3.5], [40, 200, 360, 520, 680])
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    castTimeMs: 640,
    interruptCommitMs: 560,
    retainsCastLockoutAfterInterrupt: true,
    effects: []
  },
  [ID.BLADESONG_DISTORTION]: {
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    ...shatterSkill({
      slot: 4,
      kind: 'blade-defense',
      resolver: 'mesmer.virtuoso.bladesong',
      minimumResource: 1,
      coefficients: [0, 0, 0, 0, 0, 0]
    }),
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    blade: true,
    castTimeMs: 0,
    effects: []
  }
});

// Profile and runtime registries project the same skill-owned recipe.
export const MESMER_VIRTUOSO_SHATTERS: Readonly<Record<number, MesmerShatterDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_VIRTUOSO_SKILL_MECHANICS).flatMap(([id, skill]) =>
      skill.shatter ? [[Number(id), skill.shatter]] : []
    )
  )
);
