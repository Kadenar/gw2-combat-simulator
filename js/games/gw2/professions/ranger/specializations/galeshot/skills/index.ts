/** Explicit PvE skill mechanics owned by the Galeshot Ranger module. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Cyclone Bow entry and exit are state-selected variants of one F5 UI tile.
const CYCLONE_BOW_PALETTE_TILE = 'galeshot-cyclone-bow';
// Keen Shot flips to Hawkeye at full Wind Force without creating a second weapon tile.
const CYCLONE_BOW_ONE_PALETTE_TILE = 'galeshot-cyclone-bow-one';

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const GALESHOT_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WHIRLWIND]: {
    evades: true,
    effects: [],
    castTimeMs: 500
  },
  [ID.MISTRAL]: {
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: { type: 'resourceGrant', resource: 'arrows', amount: { skillField: 'arrowsRestored' } }
      }
    ],
    castTimeMs: 320,
    effects: [],
    arrowsRestored: 1
    // Custom: Opens the Mistral buff window; see `galeshot/hooks.ts`.
  },
  [ID.SUMMON_CYCLONE_BOW]: {
    castTimeMs: 0,
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [],
    // Custom: Equips Cyclone Bow, resets chains, and emits weapon-swap/state events; see `galeshot/hooks.ts`.
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.PERFECT_STORM]: {
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: { type: 'resourceGrant', resource: 'arrows', amount: { skillField: 'arrowsRestored' } }
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 2 }],
        name: 'Perfect Storm - Traveling Tornado Damage'
      },
      {
        type: 'strike',
        ticks: [680, 1200, 1720, 2240, 2760, 3280, 3800, 4320, 4840, 5360, 5880, 6400].map((atMs) => ({
          atMs,
          coefficient: 0.7
        })),
        name: 'Perfect Storm - Stationary Tornado Damage'
      },
      {
        type: 'control',
        atMs: 600,
        controlKind: 'launch'
      }
    ]),
    castTimeMs: 600,
    arrowsRestored: 2
  },
  [ID.WIND_SHEAR]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.DISMISS_CYCLONE_BOW]: {
    castTimeMs: 0,
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    // Custom: Stows Cyclone Bow, clears Wind Force, and emits weapon-swap/state events; see `galeshot/hooks.ts`.
    inputCategory: 'bar-swap' // Count the explicit bar-changing input in effort summaries.
  },
  [ID.PIERCING_GALES]: {
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: { type: 'resourceGrant', resource: 'arrows', amount: { skillField: 'arrowsRestored' } }
      }
    ],
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [480, 480, 520, 520, 600].map((atMs) => ({
          atMs,
          coefficient: 0.7
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 6
      }
    ],
    castTimeMs: 640,
    arrowsRestored: 1
  },
  [ID.SOOTHING_BREEZE]: {
    effects: [],
    castTimeMs: 500
  },
  [ID.KEEN_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 480, coefficient: 0.75 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 0,
    castTimeMs: 480
  },
  [ID.HAWKEYE]: {
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [800, 920, 1040, 1160, 1280].map((atMs) => ({
          atMs,
          coefficient: 1.36
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 0,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/hooks.ts`.

    castTimeMs: 880
  },
  [ID.BLUSTER]: {
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [520, 600, 640].map((atMs) => ({
          atMs,
          coefficient: 0.64
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 1,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/hooks.ts`.

    castTimeMs: 680,
    windForceGain: 1,
    windForceApplyMs: 480
  },
  [ID.FLEETING_ZEPHYR]: {
    evades: true,
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ],
    arrowCost: 1,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/hooks.ts`.

    castTimeMs: 520,
    windForceGain: 1,
    windForceApplyMs: 240
  },
  [ID.QUARRYS_PERIL]: {
    // Committed shortened casts retain Cloudburst's reset at their effective completion boundary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime, cast) => Boolean(cast.skill.cycloneBowSkill) && hasTrait(runtime, TRAIT.CLOUDBURST),
        do: { type: 'rechargeReset', skillIds: [ID.BLUSTER] }
      }
    ],
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      }
    ],
    arrowCost: 2,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/hooks.ts`.

    castTimeMs: 680,
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    windForceGain: 1,
    windForceApplyMs: 280
  },
  [ID.PELT]: {
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    arrowCost: 1,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/hooks.ts`.

    castTimeMs: 680,
    windForceGain: 1,
    windForceApplyMs: 280
  },
  [ID.SUPERSONIC_ARROW]: {
    // Committed shortened casts retain Cloudburst's reset at their effective completion boundary.
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime, cast) => Boolean(cast.skill.cycloneBowSkill) && hasTrait(runtime, TRAIT.CLOUDBURST),
        do: { type: 'rechargeReset', skillIds: [ID.BLUSTER] }
      }
    ],
    effects: [
      {
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ],
    arrowCost: 3,
    // Custom: Spends arrows, updates Wind Force, and applies Cyclone Bow traits; see `galeshot/hooks.ts`.

    castTimeMs: 1000,
    windForceGain: 2,
    windForceApplyMs: 760
  }
});
