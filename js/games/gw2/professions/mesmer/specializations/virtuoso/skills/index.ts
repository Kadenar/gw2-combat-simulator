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
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

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
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 200,
            coefficient: 0.25
          },
          {
            atMs: 200,
            coefficient: 0.25
          },
          {
            atMs: 200,
            coefficient: 0.25
          }
        ],
        name: 'Outgoing damage',
        persistsAfterInterrupt: true,
        actorType: 'player',
        weapon: 'dagger',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2720,
            coefficient: 0.25
          },
          {
            atMs: 2720,
            coefficient: 0.25
          },
          {
            atMs: 2760,
            coefficient: 0.25
          }
        ],
        name: 'Returning damage',
        persistsAfterInterrupt: true,
        actorType: 'player',
        weapon: 'dagger',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
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
    ],
    castTimeMs: 440
  },
  [ID.THOUSAND_CUTS]: {
    castTimeMs: 0,
    blade: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.5
          },
          {
            atMs: 520,
            coefficient: 0.5
          },
          {
            atMs: 1040,
            coefficient: 0.5
          },
          {
            atMs: 1560,
            coefficient: 0.5
          },
          {
            atMs: 2080,
            coefficient: 0.5
          },
          {
            atMs: 2600,
            coefficient: 0.5
          },
          {
            atMs: 3120,
            coefficient: 0.5
          },
          {
            atMs: 3640,
            coefficient: 0.5
          },
          {
            atMs: 4160,
            coefficient: 0.5
          },
          {
            atMs: 4680,
            coefficient: 0.5
          }
        ],
        name: 'Damage',
        actorType: 'player',
        weapon: 'unequipped',
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
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
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Rain begins after the ground-target delay observed in EVTC, then pulses once per second.
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          coefficient: 1.2
        })),
        name: 'Damage',
        actorType: 'player',
        weapon: 'utility'
      },
      {
        type: 'condition',
        ticks: [840, 1840, 2840, 3840, 4840].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 3,
          duration: 10
        }))
      }
    ])
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
