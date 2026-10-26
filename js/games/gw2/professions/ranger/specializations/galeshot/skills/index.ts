import { CONTROL, BOON, CONDITION } from '#gw2/platform/constants.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillSideEffect } from '#gw2/platform/effects/actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Explicit PvE skill mechanics owned by the Galeshot Ranger module. */

// Cyclone Bow entry and exit are state-selected variants of one F5 UI tile.
const CYCLONE_BOW_PALETTE_TILE = 'galeshot-cyclone-bow';
// Keen Shot flips to Hawkeye at full Wind Force without creating a second weapon tile.
const CYCLONE_BOW_ONE_PALETTE_TILE = 'galeshot-cyclone-bow-one';

/** Both Cyclone Bow variants reset Bluster at commitment when Cloudburst is selected. */
const cloudburstBlusterReset: SkillSideEffect = {
  on: 'castCommit',
  when: (runtime, cast) => Boolean(cast.skill.cycloneBowSkill) && hasTrait(runtime, TRAIT.CLOUDBURST),
  do: { type: 'rechargeReset', skillIds: [ID.BLUSTER] }
};

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const GALESHOT_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.WHIRLWIND]: {
    evades: true,
    castTimeMs: 500,
    effects: []
  },
  [ID.MISTRAL]: {
    // The enhancement window and its missile payload belong to the activating skill.
    duration: 6,
    arrowsRestored: 1,
    castTimeMs: 320,
    effects: [],
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      // Open the enhancement before restoring arrows, matching the activation ordering.
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'ranger.mistral',
          id: 'missile-trigger',
          effects: [
            { name: 'Strike', type: 'strike', coefficient: 0.3, hits: 1 },
            { name: CONDITION.CHILLED, type: 'condition', condition: CONDITION.CHILLED, duration: 1, stacks: 1 }
          ]
        }
      },
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ]
  },
  [ID.SUMMON_CYCLONE_BOW]: {
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 1,
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Change bars and notify shared swap observers only after commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.cyclone-bow-enter' } }]
  },
  [ID.PERFECT_STORM]: {
    arrowsRestored: 2,
    castTimeMs: 600,
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
        controlKind: CONTROL.LAUNCH
      }
    ]),
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ]
  },
  [ID.WIND_SHEAR]: {
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DISMISS_CYCLONE_BOW]: {
    paletteTileId: CYCLONE_BOW_PALETTE_TILE,
    paletteTileOrder: 2,
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    castTimeMs: 0,
    effects: [],
    // Change bars and notify shared swap observers only after commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.cyclone-bow-dismiss' } }]
  },
  [ID.PIERCING_GALES]: {
    arrowsRestored: 1,
    castTimeMs: 640,
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
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 6
      }
    ],
    // Accepted starts restore the live arrow amount through the existing capped recovery clock.
    sideEffects: [
      {
        on: 'castStart',
        when: (_runtime, cast) => !cast.cancelled,
        do: {
          type: 'resourceGrant',
          id: 'arrows-restored',
          label: 'Arrows restored',
          resource: 'arrows',
          amount: { skillField: 'arrowsRestored' }
        }
      }
    ]
  },
  [ID.SOOTHING_BREEZE]: {
    castTimeMs: 500,
    effects: []
  },
  [ID.KEEN_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 1,
    arrowCost: 0,
    castTimeMs: 480,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 480, coefficient: 0.75 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAWKEYE]: {
    paletteTileId: CYCLONE_BOW_ONE_PALETTE_TILE,
    paletteTileOrder: 2,
    arrowCost: 0,

    castTimeMs: 880,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
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
    // An accepted Hawkeye attempt consumes Wind Force even when interrupted.
    sideEffects: [{ on: 'castStart', do: { type: 'ranger.hawkeye' } }]
  },
  [ID.BLUSTER]: {
    arrowCost: 1,
    windForceGain: 1,
    windForceApplyMs: 480,

    castTimeMs: 680,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
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
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ]
  },
  [ID.FLEETING_ZEPHYR]: {
    evades: true,
    arrowCost: 1,
    windForceGain: 1,
    windForceApplyMs: 240,

    castTimeMs: 520,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 4
      }
    ],
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ]
  },
  [ID.QUARRYS_PERIL]: {
    arrowCost: 2,
    windForceGain: 1,
    windForceApplyMs: 280,

    castTimeMs: 680,
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2
      }
    ],
    // Committed shortened casts retain Cloudburst's reset at their effective completion boundary.
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } },
      cloudburstBlusterReset
    ]
  },
  [ID.PELT]: {
    arrowCost: 1,
    windForceGain: 1,
    windForceApplyMs: 280,

    castTimeMs: 680,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } }
    ]
  },
  [ID.SUPERSONIC_ARROW]: {
    arrowCost: 3,
    windForceGain: 2,
    windForceApplyMs: 760,

    castTimeMs: 1000,
    effects: [
      {
        weaponStrengthProfileId: 'transform.cyclone-bow',
        type: 'strike',
        projectile: true,
        ticks: [{ atMs: 800, coefficient: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ],
    // Committed shortened casts retain Cloudburst's reset at their effective completion boundary.
    sideEffects: [
      // Pay for accepted attempts; the guarded gain retains its precommit task deadline.
      { on: 'castStart', do: { type: 'ranger.arrow-spend' } },
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'ranger.wind-force-start' } },
      cloudburstBlusterReset
    ]
  }
});

/** Piercing Gales reads live vulnerability in addition to the ordinary platform multiplier. */
export const piercingGalesModifier: Gw2ModifierRule = {
  id: 'ranger.piercing-gales-vulnerability',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  // Piercing Gales applies its own doubled vulnerability multiplier (2% per
  // stack) in addition to the standard vulnerability already baked into the
  // platform strikeMultiplier, effectively tripling the vulnerability bonus
  // for this skill.
  parameters: {
    baseFactor: 1,
    vulnerabilityPerStack: 0.02
  },
  factor: (context, _target, parameters) =>
    parameters.baseFactor +
    (context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) *
      parameters.vulnerabilityPerStack,
  when: (context) => Number(context.event?.skillId ?? context.skillId) === ID.PIERCING_GALES
};
