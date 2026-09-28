/**
 * Core-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerCloneAttack, MesmerTraitDamage } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

export const MESMER_CORE_WEAPON_STRENGTH: Readonly<Record<string, number>> = Object.freeze({
  Axe: 1000,
  Dagger: 1000,
  Focus: 900,
  Greatsword: 1100,
  Hammer: 1100,
  Pistol: 1000,
  Rifle: 1150,
  Scepter: 1000,
  Shield: 900,
  Spear: 1000,
  Staff: 1100,
  Sword: 1000,
  Torch: 900,
  Utility: 690.5,
  Unequipped: 690.5,
  'Phantasm high': 2877,
  'Phantasm medium': 2615.5,
  'Phantasm defender': 2362.5
});
export const MESMER_CORE_CLONE_ATTACKS: Readonly<Record<string, MesmerCloneAttack>> = Object.freeze({
  Axe: {
    weaponStrength: 28.5,
    id: ID.LACERATING_CHOP,
    name: 'Clone: Lacerating Chop',
    coefficient: 0.55,
    hits: 1,
    firstAttackDelay: 1.2,
    castTimeMs: 1520,
    damageAtMs: 520,
    interval: 1.56,
    conditions: [
      {
        name: 'Bleeding',
        duration: 1,
        stacks: 1
      },
      {
        name: 'Torment',
        duration: 1,
        stacks: 1
      }
    ]
  },
  Dagger: {
    name: 'Clone: Flying Cutter',
    coefficient: 0.5,
    hits: 1,
    firstAttackDelay: 1.16,
    interval: 1.6,
    weaponStrength: 26.5
  },
  Greatsword: {
    firstAttackDelay: 1.14,
    ticks: [
      { atMs: 520, coefficient: 0.8 / 3 },
      { atMs: 760, coefficient: 0.8 / 3 },
      { atMs: 1000, coefficient: 0.8 / 3 }
    ],
    interval: 3.44,
    weaponStrength: 26.5
  },
  Rifle: {
    coefficient: 0.5,
    hits: 1,
    interval: 1.2,
    weaponStrength: 26.5
  },
  Scepter: {
    name: 'Clone: Ether Bolt',
    coefficient: 0.5,
    hits: 1,
    interval: 2,
    weaponStrength: 34,
    conditions: [
      {
        name: 'Torment',
        duration: 4,
        stacks: 1
      }
    ]
  },
  Spear: {
    weaponStrength: 26.3,
    sequence: [
      {
        name: 'Clone: Psycut',
        coefficient: 1,
        hits: 1,
        interval: 0.6
      },
      {
        name: 'Clone: Psystrike',
        coefficient: 1,
        hits: 1,
        interval: 0.78
      },
      {
        name: 'Clone: Mind Pierce',
        coefficient: 1.5,
        hits: 1,
        interval: 0.84
      }
    ]
  },
  Staff: {
    name: 'Clone: Winds of Chaos',
    coefficient: 0.49,
    hits: 2,
    atMs: 0,
    // Delay the first impact to include clone startup and projectile travel observed in combat logs.
    firstAttackDelay: 1.96,
    interval: 2.24,
    weaponStrength: 26,
    conditions: [
      {
        name: 'Torment',
        duration: 2,
        stacks: 1
      },
      {
        name: 'Confusion',
        duration: 2,
        stacks: 1
      }
    ]
  },
  Sword: {
    weaponStrength: 20.5,
    firstAttackDelay: 2.48,
    sequence: [
      {
        name: 'Clone: Mind Slash',
        coefficient: 0.75,
        hits: 1,
        interval: 0.8266666666666667
      },
      {
        name: 'Clone: Mind Gash',
        coefficient: 0.75,
        hits: 1,
        interval: 0.8266666666666667
      },
      {
        name: 'Clone: Mind Stab',
        coefficient: 0.12,
        hits: 1,
        interval: 0.8266666666666667
      }
    ]
  }
});
export const MESMER_CORE_TRAIT_DAMAGE: Readonly<Record<string, MesmerTraitDamage>> = Object.freeze({
  'Lesser Chaos Storm': {
    // Each storm pulse is a distinct strike packet, not an aggregate hit count.
    ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: index * 1000, coefficient: 1.98 / 6 })),
    cooldown: 28
  }
});
