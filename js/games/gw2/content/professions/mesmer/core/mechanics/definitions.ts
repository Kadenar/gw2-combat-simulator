/**
 * Core-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type {
  MesmerCloneAttack,
  MesmerPhantasmAttackTiming,
  MesmerShatter,
  MesmerTraitDamage
} from '#gw2/content/professions/mesmer/types.js';

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
      { atMs: 518, coefficient: 0.8 / 3 },
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
    firstAttackDelay: 1.12,
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
export const MESMER_CORE_PHANTASM_ATTACK_TIMINGS: Readonly<Record<number, Partial<MesmerPhantasmAttackTiming>>> =
  Object.freeze({
    [ID.PHANTASMAL_SWORDSMAN]: {
      castTimeMs: 880,
      damageAtMs: 2279,
      // The supplied power-Chrono lifecycle converts Swordsman at a 3.41s median after its cast completes.
      spawnAtMs: 3410,
      phantasmalBladeDelayAfterSpawnMs: 83
    },
    [ID.PHANTASMAL_DUELIST]: {
      castTimeMs: 560,
      damageAtMs: 2230,
      // Measured packet and conversion offsets stay anchored to the observed cast end.
      spawnAtMs: 2800,
      phantasmalBladeDelayAfterSpawnMs: 175
    },
    [ID.PHANTASMAL_MAGE]: {
      castTimeMs: 800,
      damageAtMs: 2000,
      spawnAtMs: 2240
    },
    [ID.PHANTASMAL_WARLOCK]: {
      castTimeMs: 780,
      damageAtMs: 2900,
      damageAtMsByEntity: [2800, 2900],
      // Both Warlocks retain their observed attack and clone-conversion stagger.
      spawnAtMs: 4120,
      spawnAtMsByEntity: [4080, 4180],
      damageTicksByEntity: [
        {
          'One warlock': [{ atMs: 1200 }, { atMs: 2000 }, { atMs: 2800 }]
        },
        {
          'One warlock': [{ atMs: 1300 }, { atMs: 2100 }, { atMs: 2900 }]
        }
      ]
    },
    [ID.PHANTASMAL_BERSERKER]: {
      castTimeMs: 560,
      damageAtMs: 1340,
      damageAtMsByEntity: [1080, 1340],
      spawnAtMs: 2620,
      spawnAtMsByEntity: [2360, 2620],
      damageTicksByEntity: [
        {
          'One berserker': [{ atMs: 720 }, { atMs: 840 }, { atMs: 960 }, { atMs: 1080 }]
        },
        {
          'One berserker': [{ atMs: 980 }, { atMs: 1100 }, { atMs: 1220 }, { atMs: 1340 }]
        }
      ]
    },
    [ID.PHANTASMAL_DISENCHANTER]: {
      castTimeMs: 760,
      damageAtMs: 1240,
      // The dedicated lifecycle converts Disenchanter about 1.92s after cast completion.
      spawnAtMs: 1920
    },
    [ID.PHANTASMAL_WARDEN]: {
      castTimeMs: 460,
      damageAtMs: 4880,
      spawnAtMs: 7040
    },
    [ID.PHANTASMAL_DEFENDER]: {
      castTimeMs: 780,
      damageAtMs: 3800,
      spawnAtMs: 4510
    },
    [ID.ECHO_OF_MEMORY]: {
      castTimeMs: 1640,
      damageAtMs: 1440,
      spawnAtMs: 2160
    },
    [ID.PHANTASMAL_SHARPSHOOTER]: {
      castTimeMs: 520,
      damageAtMs: 1550,
      spawnAtMs: 1560,
      estimated: true
    },
    [ID.PHANTASMAL_LANCER]: {
      castTimeMs: 520,
      // Clarity agents spawn together, but their observed attacks/conversions can stagger:
      // representative per-entity offsets were damage [920, 1200] and conversion [1760, 2040].
      // Keep the single-Lancer profile until exact shatter-window fidelity needs a Clarity-only override.
      damageAtMs: 1160,
      spawnAtMs: 2040,
      // The trait blade lands about one second after the Lancer's javelin hit.
      phantasmalBladeDelayAfterSpawnMs: 120
    }
  });
export const MESMER_CORE_TRAIT_DAMAGE: Readonly<Record<string, MesmerTraitDamage>> = Object.freeze({
  'Lesser Chaos Storm': {
    // Each storm pulse is a distinct strike packet, not an aggregate hit count.
    ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: index * 1000, coefficient: 1.98 / 6 })),
    cooldown: 28
  }
});
export const MESMER_CORE_SHATTERS: Readonly<Record<number, MesmerShatter>> = Object.freeze({
  [ID.CRY_OF_FRUSTRATION]: {
    slot: 2,
    kind: 'confusion',
    resolver: 'mesmer.core.clone-shatter',
    coefficients: [0.42, 0.84, 1.25, 1.67]
  },
  [ID.MIND_WRACK]: {
    slot: 1,
    kind: 'power',
    resolver: 'mesmer.core.clone-shatter',
    coefficients: [0.81, 1.61, 2.42, 3.22]
  },
  [ID.DISTORTION]: {
    slot: 4,
    kind: 'defense',
    resolver: 'mesmer.core.clone-shatter',
    coefficients: [0, 0, 0, 0]
  },
  [ID.DIVERSION]: {
    slot: 3,
    kind: 'control',
    resolver: 'mesmer.core.clone-shatter',
    coefficients: [0, 0, 0, 0]
  }
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
  ID.COUNTER_BLADE
]);
export const MESMER_CORE_BLIND_SKILLS: ReadonlySet<number> = new Set<number>([
  ID.COUNTERSPELL,
  ID.SIGNET_OF_MIDNIGHT,
  ID.THE_PRESTIGE,
  ID.CHAOS_ARMOR
]);
export const MESMER_CORE_ARISTOCRACY_SKILLS: ReadonlySet<number> = new Set<number>([
  ID.MIND_SLASH,
  ID.MIND_GASH,
  ID.MIND_PIERCE
]);
export const MESMER_CORE_PEITHA_SKILLS: ReadonlySet<number> = new Set<number>([
  ID.BLINK,
  ID.PHASE_RETREAT,
  ID.AXES_OF_SYMMETRY,
  ID.MENTAL_COLLAPSE
]);
export const MESMER_CORE_PEITHA_PROJECTILE_DELAYS: Readonly<Record<number, number>> = Object.freeze({
  [ID.AXES_OF_SYMMETRY]: 0.519,
  [ID.PHASE_RETREAT]: 0.856,
  [ID.MENTAL_COLLAPSE]: 0.8
});
