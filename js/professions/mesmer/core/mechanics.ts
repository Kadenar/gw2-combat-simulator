/**
 * Core-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from "../data/ids.js";
import type {
  MesmerAmbushAttack,
  MesmerCloneAttack,
  MesmerInstrument,
  MesmerPhantasmAttackTiming,
  MesmerShatter,
  MesmerTraitDamage,
} from "../types.js";

export const MESMER_CORE_WEAPON_STRENGTH: Readonly<Record<string, number>> =
  Object.freeze({
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
    "Phantasm high": 2877,
    "Phantasm medium": 2615.5,
    "Phantasm defender": 2362.5,
  });
export const MESMER_CORE_CLONE_ATTACKS: Readonly<
  Record<string, MesmerCloneAttack>
> = Object.freeze({
  Axe: {
    weaponStrength: 28.5,
    sequence: [
      {
        name: "Clone: Lacerating Chop",
        coefficient: 0.55,
        hits: 1,
        interval: 1.51,
        conditions: [
          {
            name: "Bleeding",
            duration: 2,
            stacks: 1,
          },
        ],
      },
      {
        name: "Clone: Ethereal Chop",
        coefficient: 0.55,
        hits: 1,
        interval: 1.61,
        conditions: [
          {
            name: "Torment",
            duration: 2,
            stacks: 1,
          },
        ],
      },
      {
        name: "Clone: Mirror Strikes",
        coefficient: 1.1,
        hits: 2,
        interval: 1.17,
        conditions: [
          {
            name: "Bleeding",
            duration: 6,
            stacks: 1,
          },
          {
            name: "Torment",
            duration: 6,
            stacks: 1,
          },
        ],
      },
    ],
  },
  Dagger: {
    name: "Clone: Flying Cutter",
    coefficient: 0.5,
    hits: 1,
    firstAttackDelay: 1.16,
    interval: 1.6,
    weaponStrength: 26.5,
  },
  Greatsword: {
    coefficient: 0.8,
    hits: 3,
    firstAttackDelay: 1.14,
    hitOffsets: [0.518, 0.760, 1.000],
    interval: 3.44,
    weaponStrength: 26.5,
  },
  Rifle: {
    coefficient: 0.5,
    hits: 1,
    interval: 1.2,
    weaponStrength: 26.5,
  },
  Scepter: {
    name: "Clone: Ether Bolt",
    coefficient: 0.5,
    hits: 1,
    interval: 2,
    weaponStrength: 34,
    conditions: [
      {
        name: "Torment",
        duration: 4,
        stacks: 1,
      },
    ],
  },
  Spear: {
    weaponStrength: 26.3,
    sequence: [
      {
        name: "Clone: Psycut",
        coefficient: 1,
        hits: 1,
        interval: 0.6,
      },
      {
        name: "Clone: Psystrike",
        coefficient: 1,
        hits: 1,
        interval: 0.78,
      },
      {
        name: "Clone: Mind Pierce",
        coefficient: 1.5,
        hits: 1,
        interval: 0.84,
      },
    ],
  },
  Staff: {
    name: "Clone: Winds of Chaos",
    coefficient: 0.49,
    hits: 2,
    firstAttackDelay: 1.12,
    interval: 2.24,
    weaponStrength: 26,
    conditions: [
      {
        name: "Torment",
        duration: 2,
        stacks: 1,
      },
      {
        name: "Confusion",
        duration: 2,
        stacks: 1,
      },
    ],
  },
  Sword: {
    weaponStrength: 20.5,
    firstAttackDelay: 2.48,
    sequence: [
      {
        name: "Clone: Mind Slash",
        coefficient: 0.75,
        hits: 1,
        interval: 0.8266666666666667,
      },
      {
        name: "Clone: Mind Gash",
        coefficient: 0.75,
        hits: 1,
        interval: 0.8266666666666667,
      },
      {
        name: "Clone: Mind Stab",
        coefficient: 0.12,
        hits: 1,
        interval: 0.8266666666666667,
      },
    ],
  },
});
export const MESMER_CORE_AMBUSH_ATTACKS: Readonly<
  Record<string, MesmerAmbushAttack>
> = Object.freeze({});
export const MESMER_CORE_PHANTASM_ATTACK_TIMINGS: Readonly<
  Record<number, Partial<MesmerPhantasmAttackTiming>>
> = Object.freeze({
  [ID.PHANTASMAL_SWORDSMAN]: {
    castTimeMs: 880,
    damageAtMs: 2279,
    spawnAtMs: 3600,
    damageTicks: {
      "Phantasm leap": [
        {
          atMs: 845,
        },
      ],
      "Phantasm Blurred Frenzy": [
        {
          atMs: 1321,
        },
        {
          atMs: 1362,
        },
        {
          atMs: 1645,
        },
        {
          atMs: 1679,
        },
        {
          atMs: 1920,
        },
        {
          atMs: 1962,
        },
        {
          atMs: 2246,
        },
        {
          atMs: 2279,
        },
      ],
    },
    phantasmalBladeDelayAfterSpawnMs: 83,
  },
  [ID.PHANTASMAL_DUELIST]: {
    castTimeMs: 560,
    damageAtMs: 2400,
    spawnAtMs: 2880,
    damageTicks: {
      "Illusion Damage": [
        {
          atMs: 791,
        },
        {
          atMs: 991,
        },
        {
          atMs: 1190,
        },
        {
          atMs: 1390,
        },
        {
          atMs: 1591,
        },
        {
          atMs: 1790,
        },
        {
          atMs: 1990,
        },
        {
          atMs: 2400,
        },
      ],
    },
    phantasmalBladeDelayAfterSpawnMs: 175,
  },
  [ID.PHANTASMAL_MAGE]: {
    castTimeMs: 800,
    damageAtMs: 2270,
    spawnAtMs: 2520,
  },
  [ID.PHANTASMAL_WARLOCK]: {
    castTimeMs: 780,
    damageAtMs: 2960,
    spawnAtMs: 4240,
  },
  [ID.PHANTASMAL_BERSERKER]: {
    castTimeMs: 560,
    damageAtMs: 1480,
    spawnAtMs: 2560,
  },
  [ID.PHANTASMAL_DISENCHANTER]: {
    castTimeMs: 760,
    damageAtMs: 1150,
    spawnAtMs: 1840,
  },
  [ID.PHANTASMAL_WARDEN]: {
    castTimeMs: 460,
    damageAtMs: 5040,
    spawnAtMs: 7240,
  },
  [ID.PHANTASMAL_DEFENDER]: {
    castTimeMs: 780,
    damageAtMs: 3800,
    spawnAtMs: 4510,
  },
  [ID.ECHO_OF_MEMORY]: {
    castTimeMs: 1640,
    damageAtMs: 1440,
    spawnAtMs: 2160,
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    castTimeMs: 520,
    damageAtMs: 1550,
    spawnAtMs: 1560,
    estimated: true,
  },
  [ID.PHANTASMAL_LANCER]: {
    castTimeMs: 520,
    damageAtMs: 1080,
    spawnAtMs: 1080,
    estimated: true,
  },
});
export const MESMER_CORE_TRAIT_DAMAGE: Readonly<
  Record<string, MesmerTraitDamage>
> = Object.freeze({
  "Lesser Chaos Storm": {
    coefficient: 1.98,
    hits: 6,
    interval: 1,
    cooldown: 28,
  },
});
export const MESMER_CORE_SHATTERS: Readonly<Record<number, MesmerShatter>> =
  Object.freeze({
    [ID.CRY_OF_FRUSTRATION]: {
      slot: 2,
      kind: "core-confusion",
      coefficients: [0.42, 0.84, 1.25, 1.67],
    },
    [ID.MIND_WRACK]: {
      slot: 1,
      kind: "core-power",
      coefficients: [0.81, 1.61, 2.42, 3.22],
    },
    [ID.DISTORTION]: {
      slot: 4,
      kind: "defense",
      coefficients: [0, 0, 0, 0],
    },
    [ID.DIVERSION]: {
      slot: 3,
      kind: "control",
      coefficients: [0, 0, 0, 0],
    },
  });
export const MESMER_CORE_CONTROL_SKILLS: ReadonlySet<number> = new Set<number>([
  ID.CHAOS_STORM,
  ID.ILLUSIONARY_WAVE,
  ID.MAGIC_BULLET,
  ID.SIGNET_OF_DOMINATION,
  ID.PHANTASMAL_DEFENDER,
  ID.SIGNET_OF_HUMILITY,
  ID.TIDES_OF_TIME,
  ID.PHANTASMAL_SHARPSHOOTER,
  ID.DIVERSION,
  ID.INTO_THE_VOID,
  ID.COUNTER_BLADE,
]);
export const MESMER_CORE_BLIND_SKILLS: ReadonlySet<number> = new Set<number>([
  ID.COUNTERSPELL,
  ID.SIGNET_OF_MIDNIGHT,
  ID.THE_PRESTIGE,
  ID.CHAOS_ARMOR,
]);
export const MESMER_CORE_ARISTOCRACY_SKILLS: ReadonlySet<number> =
  new Set<number>([ID.MIND_SLASH, ID.MIND_GASH, ID.MIND_PIERCE]);
export const MESMER_CORE_PEITHA_SKILLS: ReadonlySet<number> = new Set<number>([
  ID.BLINK,
  ID.PHASE_RETREAT,
  ID.AXES_OF_SYMMETRY,
]);
export const MESMER_CORE_INSTRUMENTS: Readonly<
  Record<number, MesmerInstrument>
> = Object.freeze({});
