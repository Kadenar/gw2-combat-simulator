import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
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

/**
 * Owns Virtuoso dagger, slot-skill, and bladesong catalog fragments.
 * Blade storage and bladesong runtime behavior lives under `mechanics/`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

export const MESMER_VIRTUOSO_SKILL_MECHANICS: Readonly<Record<SkillId, Partial<MesmerSkill>>> = Object.freeze({
  [ID.BLADECALL]: {
    interruptCommitMs: 280,
    retainsCastLockoutAfterInterrupt: true,
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 200
    },
    blade: true,
    // Group simultaneous daggers per impact while preserving the outgoing and returning projectile effects.
    effects: [
      { atMs: 200, hits: 3 },
      { atMs: 2720, hits: 2 },
      { atMs: 2760, hits: 1 }
    ].flatMap(({ atMs, hits }) =>
      impactEffects({ atMs, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'strike',
          coefficient: 0.25 * hits,
          hits,
          actorType: 'player',
          weapon: 'dagger',
          comboFinishers: [
            {
              ownerId: 'mesmer',
              finisherType: 'Projectile',
              chance: 0.2,
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        }
      ])
    ),
    castTimeMs: 440
  },
  [ID.THOUSAND_CUTS]: {
    castTimeMs: 0,
    blade: true,
    // The portal delivers ten equal impacts at a fixed cadence after its startup delay.
    effects: Array.from({ length: 10 }, (_, index) => 560 + index * 520).flatMap((atMs) =>
      impactEffects({ atMs, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.5,
          hits: 1,
          actorType: 'player',
          weapon: 'unequipped'
        }
      ])
    )
  },
  [ID.SWORD_OF_DECIMATION]: {
    // Resolve the strike after the reviewed activation duration.
    castTimeMs: 720,
    blade: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      },
      // The falling blade immobilizes at the same impact as its strike (wiki: Sword_of_Decimation, PvE).
      { type: 'condition', condition: 'Immobilized', stacks: 1, duration: 4 }
    ]
  },
  [ID.BLADE_RENEWAL]: {
    // Fill stored blades only after the reviewed channel completes.
    castTimeMs: 2040,
    resource: {
      mode: 'fill',
      count: 5
    },
    blade: true,
    effects: []
  },
  [ID.RAIN_OF_SWORDS]: {
    castTimeMs: 680,
    blade: true,
    // Each delayed pulse owns its strike and vulnerability together so they share the same impact timing.
    effects: Array.from({ length: 5 }, (_, index) => 840 + index * 1000).flatMap((atMs) =>
      impactEffects({ atMs, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.2,
          hits: 1,
          actorType: 'player',
          weapon: 'utility'
        },
        { type: 'condition', condition: 'Vulnerability', stacks: 3, duration: 10 }
      ])
    )
  },
  [ID.TWIN_BLADE_RESTORATION]: {
    castTimeMs: 680,
    blade: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 2,
        atMs: 0,
        name: 'Damage',
        actorType: 'player',
        weapon: 'unequipped'
      }
    ]
  },
  [ID.BLADETURN_REQUIEM]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.virtuoso.bladeturn-requiem',
      slot: 5,
      kind: 'blade-requiem',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.5, 1, 1.5, 2, 2.5],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.5, 1, 1.5, 2, 2.5], [1000, 2000, 3000, 4000, 5000])
    },
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    effects: []
  },
  [ID.BLADESONG_DISSONANCE]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.virtuoso.bladesong-dissonance',
      slot: 3,
      kind: 'blade-control',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 1, 1, 1, 1, 1],
      minimumResource: 1,
      resourceSpendProgress: 1,
      damageAtMs: 400
    },
    castTimeMs: 480,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
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
  },
  [ID.BLADESONG_SORROW]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.virtuoso.bladesong-sorrow',
      slot: 2,
      kind: 'blade-confusion',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.42, 0.84, 1.25, 1.67, 2.09],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.42, 0.84, 1.25, 1.67, 2.09], [440, 520, 600, 680, 680]),
      effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 3, stacks: 1 }]
    },
    castTimeMs: 480,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    effects: []
  },
  [ID.BLADESONG_HARMONY]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.virtuoso.bladesong-harmony',
      slot: 1,
      kind: 'blade-power',
      resolver: 'mesmer.virtuoso.bladesong',
      coefficients: [0, 0.7, 1.4, 2.1, 2.8, 3.5],
      minimumResource: 1,
      resourceSpendProgress: 1,
      ticks: bladePacketTiers([0, 0.7, 1.4, 2.1, 2.8, 3.5], [40, 200, 360, 520, 680])
    },
    castTimeMs: 640,
    interruptCommitMs: 560,
    retainsCastLockoutAfterInterrupt: true,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    blade: true,
    effects: []
  },
  [ID.BLADESONG_DISTORTION]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'mesmer.shatter' } }],
    // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
    shatter: {
      balanceProfileId: 'mesmer.virtuoso.bladesong-distortion',
      slot: 4,
      kind: 'blade-defense',
      resolver: 'mesmer.virtuoso.bladesong',
      minimumResource: 1,
      coefficients: [0, 0, 0, 0, 0, 0]
    },
    castTimeMs: 0,
    lockouts: [
      {
        group: 'mesmer.shatter',
        durationMs: 50
      }
    ],
    rechargeAnchor: 'castStart',
    blade: true,
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
