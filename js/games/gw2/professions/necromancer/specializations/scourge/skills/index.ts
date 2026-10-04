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

// Herald of Sorrow swaps Desert Shroud for Sandstorm Shroud; both are state-selected variants of one UI tile.
const SCOURGE_SHROUD_PALETTE_TILE = 'scourge-desert-shroud';

export const SCOURGE_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.NEFARIOUS_FAVOR]: {
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castStart', do: { type: 'necromancer.life-force-cost' } },
      { on: 'castCommit', do: { type: 'scourge.cleanse' } },
      { on: 'castCommit', do: { type: 'scourge.strike' } }
    ],
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 21
  },
  [ID.SERPENT_SIPHON]: {
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [{ on: 'castCommit', do: { type: 'scourge.barrier' } }],
    castTimeMs: 360,
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 10
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.GHASTLY_BREACH]: {
    castTimeMs: 680,
    comboFields: [{ ownerId: 'necromancer', fieldType: 'Dark', duration: 5, startAnchor: 'castEnd' }],
    // Five fixed pulses share strike, condition, and ally-boon timing; boon-conversion Torment is not simulated.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: index * 1000, coefficient: 3.5 / 5 }))
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 2,
        duration: 6,
        applications: 5,
        intervalMs: 1000,
        audience: { recipients: 'party', maximumRecipients: 5 }
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
            actor: 'player',
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
        condition: 'Torment',
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.SAND_FLARE]: {
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [{ on: 'castCommit', do: { type: 'scourge.barrier' } }],
    castTimeMs: 680,
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.SAND_CASCADE]: {
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castStart', do: { type: 'necromancer.life-force-cost' } },
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      { on: 'castCommit', do: { type: 'scourge.barrier' } }
    ],
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 27
  },
  [ID.GARISH_PILLAR]: {
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castStart', do: { type: 'necromancer.life-force-cost' } },
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      { on: 'castCommit', do: { type: 'scourge.garish-pillar' } }
    ],
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 40
  },
  [ID.DESERT_SHROUD]: {
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castStart', do: { type: 'necromancer.life-force-cost' } },
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      { on: 'castCommit', do: { type: 'scourge.barrier' } },
      { on: 'castCommit', do: { type: 'scourge.desert-shroud' } }
    ],
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 50,
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
    // Each command declares its intrinsic work; barrier and shroud trait observers retain their shared owners.
    sideEffects: [
      { on: 'castStart', do: { type: 'necromancer.life-force-cost' } },
      { on: 'castCommit', do: { type: 'scourge.strike' } },
      { on: 'castCommit', do: { type: 'scourge.sandstorm-shroud' } }
    ],
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 35,
    flipParentId: null,
    paletteTileId: SCOURGE_SHROUD_PALETTE_TILE,
    paletteTileOrder: 2
  }
});
