/**
 * Scourge skill mechanics owned by the Scourge Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SCOURGE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.NEFARIOUS_FAVOR]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 21,
    // Custom: Spends life force and resolves shade placement/pulses against live shade state; see `scourge/mechanics/shades.ts`.
    handlerId: 'necromancer.shade'
  },
  [ID.SERPENT_SIPHON]: {
    implemented: true,
    castTimeMs: 500,
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
    ],
    // Custom: Applies barrier-triggered Scourge traits; see `scourge/mechanics/shades.ts`.
    handlerId: 'necromancer.barrier'
  },
  [ID.GHASTLY_BREACH]: {
    implemented: true,
    castTimeMs: 1000,
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
    implemented: true,
    castTimeMs: 500,
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
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 8
      }
    ],
    // Custom: Applies barrier-triggered Scourge traits; see `scourge/mechanics/shades.ts`.
    handlerId: 'necromancer.barrier'
  },
  [ID.SAND_CASCADE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 27,
    // Custom: Spends life force and resolves shade placement/pulses against live shade state; see `scourge/mechanics/shades.ts`.
    handlerId: 'necromancer.shade'
  },
  [ID.GARISH_PILLAR]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 40,
    // Custom: Spends life force and resolves shade placement/pulses against live shade state; see `scourge/mechanics/shades.ts`.
    handlerId: 'necromancer.shade'
  },
  [ID.DESERT_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 50,
    // Custom: Spends life force and resolves shade placement/pulses against live shade state; see `scourge/mechanics/shades.ts`.
    handlerId: 'necromancer.shade',
    flipSkillId: null
  },
  [ID.MANIFEST_SAND_SHADE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [],
    cooldown: 15,
    ammo: 3,
    ammoRecharge: 15,
    specialization: 'Scourge',
    // Custom: Spends life force and resolves shade placement/pulses against live shade state; see `scourge/mechanics/shades.ts`.
    handlerId: 'necromancer.shade'
  },
  [ID.SANDSTORM_SHROUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    specialization: 'Scourge',
    lifeForceCost: 35,
    // Custom: Spends life force and resolves shade placement/pulses against live shade state; see `scourge/mechanics/shades.ts`.
    handlerId: 'necromancer.shade',
    flipParentId: null
  }
});
