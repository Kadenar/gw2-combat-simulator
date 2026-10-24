import { COMBO_FIELD, RECIPIENT, ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
/**
 * Scourge skill mechanics owned by the Scourge Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';

// Intrinsic applications are removable effects, so only delivered barriers can trigger traits.
const barrier: SkillEffect = {
  type: 'buff',
  name: 'barrier',
  kind: 'barrier',
  stacks: 1,
  duration: 5,
  atMs: 0,
  timingAnchor: 'castEnd',
  timingScale: 'fixed',
  audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
};

// Herald of Sorrow swaps Desert Shroud for Sandstorm Shroud; both are state-selected variants of one UI tile.
const SCOURGE_SHROUD_PALETTE_TILE = 'scourge-desert-shroud';

// Author costs as rounded whole points so admission, payment, and tooltips agree independently of build capacity.
const SCOURGE_LIFE_FORCE_COST = {
  resource: 'lifeForce',
  skillAmount: 'lifeForceCost',
  spendOn: 'castStart'
} as const;

export const SCOURGE_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.NEFARIOUS_FAVOR]: {
    cost: SCOURGE_LIFE_FORCE_COST,
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castCommit', do: { type: 'scourge.cleanse' } },
      { on: 'castCommit', do: { type: 'scourge.strike' } }
    ],
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 1935
  },
  [ID.SERPENT_SIPHON]: {
    castTimeMs: 360,
    effects: [
      barrier,
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 10
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.GHASTLY_BREACH]: {
    castTimeMs: 680,
    comboFields: [{ ownerId: 'necromancer', fieldType: COMBO_FIELD.DARK, duration: 5, startAnchor: 'castEnd' }],
    // Five fixed pulses share strike, condition, and ally-boon timing; boon-conversion Torment is not simulated.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: index * 1000, coefficient: 3.5 / 5 }))
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        stacks: 2,
        duration: 6,
        applications: 5,
        intervalMs: 1000,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ])
  },
  [ID.DESICCATE]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 12 } })
          }
        ],
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.SAND_FLARE]: {
    castTimeMs: 680,
    effects: [
      barrier,
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.SAND_CASCADE]: {
    cost: SCOURGE_LIFE_FORCE_COST,
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [{ on: 'castCommit', do: { type: 'scourge.strike' } }],
    castTimeMs: 0,
    effects: [barrier],
    specialization: 'Scourge',
    lifeForceCost: 2487
  },
  [ID.GARISH_PILLAR]: {
    cost: SCOURGE_LIFE_FORCE_COST,
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      { on: 'castCommit', do: { type: 'scourge.garish-pillar' } }
    ],
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 3685
  },
  [ID.DESERT_SHROUD]: {
    cost: SCOURGE_LIFE_FORCE_COST,
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      { on: 'castCommit', do: { type: 'scourge.desert-shroud' } }
    ],
    castTimeMs: 0,
    effects: [barrier],
    specialization: 'Scourge',
    lifeForceCost: 4606,
    flipSkillId: null,
    paletteTileId: SCOURGE_SHROUD_PALETTE_TILE,
    paletteTileOrder: 1
  },
  [ID.MANIFEST_SAND_SHADE]: {
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castStart', do: { type: 'scourge.manifest-start' } },
      { on: 'castCommit', do: { type: 'scourge.manifest' } }
    ],
    castTimeMs: 480,
    effects: [],
    cooldown: 15,
    ammo: 3,
    ammoRecharge: 15,
    specialization: 'Scourge'
  },
  [ID.SANDSTORM_SHROUD]: {
    cost: SCOURGE_LIFE_FORCE_COST,
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      { on: 'castCommit', do: { type: 'scourge.sandstorm-shroud' } }
    ],
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 3224,
    flipParentId: null,
    paletteTileId: SCOURGE_SHROUD_PALETTE_TILE,
    paletteTileOrder: 2
  }
});
