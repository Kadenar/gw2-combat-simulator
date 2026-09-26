/**
 * Scourge skill mechanics owned by the Scourge Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Herald of Sorrow swaps Desert Shroud for Sandstorm Shroud; both are state-selected variants of one UI tile.
const SCOURGE_SHROUD_PALETTE_TILE = 'scourge-desert-shroud';

export const SCOURGE_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.NEFARIOUS_FAVOR]: {
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 21
  },
  [ID.SERPENT_SIPHON]: {
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
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: index * 1000, coefficient: 3.5 / 5 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2
      }
    ]
  },
  [ID.DESICCATE]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 8
      }
    ],
    lifeForceGain: 12
  },
  [ID.SAND_FLARE]: {
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
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 27
  },
  [ID.GARISH_PILLAR]: {
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 40
  },
  [ID.DESERT_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 50,
    flipSkillId: null,
    paletteTileId: SCOURGE_SHROUD_PALETTE_TILE,
    paletteTileOrder: 1
  },
  [ID.MANIFEST_SAND_SHADE]: {
    castTimeMs: 480,
    effects: [],
    cooldown: 15,
    ammo: 3,
    ammoRecharge: 15,
    specialization: 'Scourge'
  },
  [ID.SANDSTORM_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 35,
    flipParentId: null,
    paletteTileId: SCOURGE_SHROUD_PALETTE_TILE,
    paletteTileOrder: 2
  }
});
