/** Explicit PvE skill mechanics owned by the Core Ranger module. */
import { RANGER_SKILL_IDS as ID } from "../data/ids.js";
import type { Skill, SkillFragment } from "../../../platform/engine/types.js";

export const RANGER_CORE_BASE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.RICOCHET]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 320, coefficient: 0.9 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            chance: 0.2,
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 1,
        atMs: 320,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 600,
    missileHits: 1,
  },
  [ID.POISON_VOLLEY]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 5,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 5,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.BARRAGE]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          1440, 1920, 2400, 2880, 3480, 4080, 4680, 5280, 5880, 6480, 7080,
          7680,
        ].map((atMs) => ({ atMs, coefficient: 0.5 })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
      {
        type: "condition",
        ticks: [
          1440, 1920, 2400, 2880, 3480, 4080, 4680, 5280, 5880, 6480, 7080,
          7680,
        ].map((atMs) => ({
          atMs,
          condition: "Crippled",
          stacks: 1,
          duration: 1,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
    ],
    quicknessCastTimeMs: 1880,
  },
  [ID.CROSSFIRE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 3,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SLASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 480,
  },
  [ID.CRIPPLING_THRUST]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 2,
      },
    ],
    quicknessCastTimeMs: 320,
  },
  [ID.PRECISION_SWIPE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.4,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 1,
        affectsSelf: false,
        affectsSummons: true,
        maximumRecipients: 1,
      },
    ],
    quicknessCastTimeMs: 600,
  },
  [ID.SLASH_ID_12474]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.88,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.HILT_BASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SPIKE_TRAP]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 6,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.CRIPPLING_TALON]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.9,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 3,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 4,
      },
    ],
    quicknessCastTimeMs: 360,
  },
  [ID.STALKERS_STRIKE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.6,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 3,
        duration: 8,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 2,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 760,
  },
  [ID.SPLITBLADE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: Array.from({ length: 5 }, () => ({
          atMs: 480,
          coefficient: 0.5,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            chance: 0.2,
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "condition",
        ticks: [
          {
            atMs: 480,
            condition: "Bleeding",
            stacks: 5,
            duration: 6,
          },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 600,
    missileHits: 5,
  },
  [ID.SERPENTS_STRIKE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Leap",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 3,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Immobilized",
        stacks: 1,
        duration: 3,
      },
    ],
    quicknessCastTimeMs: 1000,
  },
  [ID.TROLL_UNGUENT]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.SLICE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.1,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.ENDURING_SWING]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.76,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.HEALING_SPRING]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "regeneration",
        duration: 3,
        stacks: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.WINTERS_BITE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 360, coefficient: 1.8 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 3,
        duration: 12,
        atMs: 360,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 4,
        atMs: 360,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 520,
    handlerId: "ranger.winters-bite",
    missileHits: 1,
  },
  [ID.SIGNET_OF_THE_WILD]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [520, 1520, 2520, 3520].map((atMs) => ({
          atMs,
          coefficient: 0.2,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
      ...[520, 1520, 2520, 3520].map((atMs) => ({
        type: "condition" as const,
        condition: "Immobilized",
        stacks: 1,
        duration: 1,
        atMs,
        timingAnchor: "castStart" as const,
        timingScale: "fixed" as const,
        persistsAfterInterrupt: true,
      })),
    ],
    quicknessCastTimeMs: 520,
  },
  [ID.FROST_TRAP]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "condition",
        ticks: [880, 1880, 2880, 3880, 4880].map((atMs) => ({
          atMs,
          condition: "Chilled",
          stacks: 1,
          duration: 2,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
      {
        type: "strike",
        ticks: [880, 1880, 2880, 3880, 4880].map((atMs) => ({
          atMs,
          coefficient: 1,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
    ],
    quicknessCastTimeMs: 520,
    comboFields: [
      {
        ownerId: "ranger",
        fieldType: "Ice",
        duration: 5,
        startMs: 880,
        startAnchor: "castStart",
      },
    ],
  },
  [ID.STORM_SPIRIT]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 10,
        duration: 10,
      },
      {
        type: "boon",
        boon: "fury",
        duration: 2,
        stacks: 4,
      },
      {
        type: "boon",
        boon: "fury",
        duration: 2,
        stacks: 4,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.LIGHTNING_REFLEXES]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "boon",
        boon: "vigor",
        duration: 10,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.STONE_SPIRIT]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "aegis",
        duration: 5,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "protection",
        duration: 2,
        stacks: 4,
      },
      {
        type: "boon",
        boon: "protection",
        duration: 2,
        stacks: 4,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.VIPERS_NEST]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [0, 1000, 2000].map((atMs) => ({
          atMs,
          coefficient: 0.3,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
      {
        type: "condition",
        ticks: [0, 1000, 2000].map((atMs) => ({
          atMs,
          condition: "Poisoned",
          stacks: 2,
          duration: 8,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
    ],
    quicknessCastTimeMs: 333,
    comboFields: [
      {
        ownerId: "ranger",
        fieldType: "Poison",
        duration: 2,
        startAnchor: "castEnd",
      },
    ],
  },
  [ID.FROST_SPIRIT]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "resistance",
        duration: 4,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "resolution",
        duration: 2,
        stacks: 4,
      },
      {
        type: "boon",
        boon: "resolution",
        duration: 2,
        stacks: 4,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.SUN_SPIRIT]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 15,
        stacks: 8,
      },
      {
        type: "blind",
        duration: 5,
      },
      {
        type: "boon",
        boon: "might",
        duration: 8,
        stacks: 8,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.FLAME_TRAP]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.3,
        hits: 1,
        name: "Flame Trap - Damage per Pulse",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 3,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SIGNET_OF_STONE]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.MUDDY_TERRAIN]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 2,
      },
      {
        type: "condition",
        condition: "Slow",
        stacks: 1,
        duration: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.SIGNET_OF_RENEWAL]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "resistance",
        duration: 3,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "resolution",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.BONFIRE]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: Array.from({ length: 9 }, (_, index) => ({
          atMs: index * 1000,
          coefficient: 0.1,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
      {
        type: "condition",
        ticks: [
          { atMs: 0, condition: "Burning", stacks: 3, duration: 5 },
          ...Array.from({ length: 8 }, (_, index) => ({
            atMs: (index + 1) * 1000,
            condition: "Burning",
            stacks: 1,
            duration: 1,
          })),
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
    ],
    recharge: 25,
    cooldown: 25,
    quicknessCastTimeMs: 333,
    comboFields: [
      {
        ownerId: "ranger",
        fieldType: "Fire",
        duration: 8,
        startAnchor: "castEnd",
      },
    ],
  },
  [ID.CRIPPLING_SHOT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 15,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 4,
      },
      {
        type: "condition",
        condition: "Immobilized",
        stacks: 1,
        duration: 1.5,
      },
    ],
    quicknessCastTimeMs: 333,
    handlerId: "ranger.crippling-shot",
  },
  [ID.CONCUSSION_SHOT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.4,
        hits: 1,
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "control",
        metadata: { controlKind: "daze" },
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.RAPID_FIRE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [360, 520, 680, 840, 1000, 1160, 1320, 1480, 1640, 1800].map(
          (atMs) => ({ atMs, coefficient: 0.6 }),
        ),
        timingAnchor: "castStart",
        timingScale: "fixed",
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            chance: 0.2,
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "condition",
        ticks: [360, 520, 680, 840, 1000, 1160, 1320, 1480, 1640, 1800].map(
          (atMs) => ({
            atMs,
            condition: "Vulnerability",
            stacks: 1,
            duration: 10,
          }),
        ),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 1800,
    missileHits: 10,
  },
  [ID.LONG_RANGE_SHOT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.33,
        hits: 1,
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            chance: 0.2,
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
    ],
    quicknessCastTimeMs: 480,
    missileHits: 1,
  },
  [ID.POINT_BLANK_SHOT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "control",
        metadata: { controlKind: "knockback" },
      },
    ],
    quicknessCastTimeMs: 360,
    missileHits: 1,
  },
  [ID.STRENGTH_OF_THE_PACK]: {
    implemented: true,
    effects: [
      {
        type: "buff",
        kind: "strength-of-the-pack",
        duration: 10,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "fury",
        duration: 12,
        stacks: 1,
        affectsSummons: true,
        maximumRecipients: 2,
      },
      {
        type: "boon",
        boon: "stability",
        duration: 8,
        stacks: 10,
        affectsSummons: true,
        maximumRecipients: 2,
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 12,
        stacks: 1,
        affectsSummons: true,
        maximumRecipients: 2,
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.QUICK_SHOT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 9,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.SWOOP]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.4,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.COUNTERATTACK]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 2000,
  },
  [ID.COUNTERATTACK_KICK]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.MAUL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.2,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 2.2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SHARPENING_STONE]: {
    implemented: true,
    effects: [],
    castTimeMs: 0,
    canCastConcurrently: true,
    handlerId: "ranger.sharpening-stone",
  },
  [ID.SIGNET_OF_THE_HUNT]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.QUICKENING_ZEPHYR]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "quickness",
        duration: 6,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SPIRIT_OF_NATURE]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "regeneration",
        duration: 3,
        stacks: 4,
      },
    ],
    quicknessCastTimeMs: 1000,
  },
  [ID.HUNTERS_SHOT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.4,
        hits: 1,
      },
      {
        type: "buff",
        kind: "stealth",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 320,
    missileHits: 1,
  },
  [ID.ENTANGLE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 4,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 5,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.SOLAR_FLARE]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Burning",
        stacks: 3,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.CALL_LIGHTNING]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.QUAKE]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.COLD_SNAP]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.NATURES_RENEWAL]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.HUNTERS_CALL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.4,
        hits: 16,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 16,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.CALL_OF_THE_WILD]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "fury",
        duration: 12,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "fury",
        duration: 6,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 12,
        stacks: 6,
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 12,
        stacks: 1,
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.PROTECT_ME]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "protection",
        duration: 4,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.GUARD]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 10,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SIC_EM]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.sic-em",
  },
  [ID.THROW_TORCH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.666,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 10,
      },
      {
        type: "blind",
        duration: 3,
      },
    ],
    recharge: 1,
    cooldown: 15,
    ammo: 2,
    ammoRecharge: 15,
    ammoCastLockout: 1,
    quicknessCastTimeMs: 333,
  },
  [ID.PATH_OF_SCARS]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 400, coefficient: 1.2 },
          { atMs: 880, coefficient: 1.2 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "control",
        atMs: 880,
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        metadata: { controlKind: "pull" },
      },
    ],
    quicknessCastTimeMs: 440,
    missileHits: 2,
  },
  [ID.WHIRLING_DEFENSE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          200, 360, 600, 840, 1040, 1280, 1520, 1680, 1920, 2160, 2360, 2600,
        ].map((atMs) => ({ atMs, coefficient: 0.66 })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "resolution",
        duration: 4,
        stacks: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 12,
        duration: 10,
        atMs: 2600,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 2720,
  },
  [ID.WATER_SPIRIT]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "vigor",
        duration: 2,
        stacks: 4,
      },
      {
        type: "boon",
        boon: "vigor",
        duration: 1,
        stacks: 4,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.AQUA_SURGE]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.SUBLIME_CONVERSION]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "regeneration",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.ANCESTRAL_GRACE]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "protection",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 833,
  },
  [ID.VINE_SURGE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.SOLAR_BEAM]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.3,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 833,
  },
  [ID.ASTRAL_WISP]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.WE_HEAL_AS_ONE]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "aegis",
        duration: 5,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "alacrity",
        duration: 3,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "fury",
        duration: 3,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "might",
        duration: 10,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "protection",
        duration: 2,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "quickness",
        duration: 2,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 5,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 3,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "resistance",
        duration: 2,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "resolution",
        duration: 5,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "stability",
        duration: 3,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 3,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
      {
        type: "boon",
        boon: "vigor",
        duration: 3,
        stacks: 1,
        metadata: { affectsSummons: true, maximumRecipients: 2 },
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.SEARCH_AND_RESCUE]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "regeneration",
        duration: 8,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.LEADING_SWIPE]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 4,
      },
      {
        type: "strike",
        coefficient: 0.42,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 320,
  },
  [ID.SERPENT_STAB]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 4,
      },
      {
        type: "strike",
        coefficient: 0.44,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 280,
  },
  [ID.DOUBLE_ARC]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 6,
        duration: 6,
      },
      {
        type: "strike",
        coefficient: 1.6,
        hits: 2,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 6,
      },
    ],
    recharge: 6,
    cooldown: 6,
    quicknessCastTimeMs: 600,
    handlerId: "ranger.poisonous-strikes",
  },
  [ID.DEADLY_DELIVERY]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 1,
        duration: 4,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 4,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 4,
      },
      {
        type: "strike",
        coefficient: 0.88,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 440,
  },
  [ID.GROUNDWORK_GOUGE]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 1,
        duration: 4,
      },
      {
        type: "strike",
        coefficient: 0.4,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 280,
  },
  [ID.INSTINCTIVE_ENGAGE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Leap",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "boon",
        boon: "quickness",
        duration: 3,
        stacks: 1,
      },
      {
        type: "condition",
        condition: "Slow",
        stacks: 1,
        duration: 2,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 4,
        duration: 8,
      },
    ],
    recharge: 12,
    cooldown: 12,
    quicknessCastTimeMs: 840,
  },
  [ID.MAUL_ID_46629]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 8,
      },
      {
        type: "strike",
        coefficient: 2.2,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.HAMMER_STRIKE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 360, coefficient: 0.8 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 480,
  },
  [ID.UNLEASHED_SAVAGE_SHOCK_WAVE]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [520, 800, 1080].map((atMs) => ({
          atMs,
          coefficient: 0.8,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: "ranger-unleashed-disabled-condition-count",
        },
      },
    ],
    quicknessCastTimeMs: 560,
  },
  [ID.UNLEASHED_OVERBEARING_SMASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 240, coefficient: 0.75 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Blindness",
        stacks: 1,
        duration: 2,
        atMs: 240,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "strike",
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        ticks: [{ atMs: 960, coefficient: 1.5 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        name: "Unleashed Overbearing Smash - Follow-Up Damage",
      },
    ],
    quicknessCastTimeMs: 960,
  },
  [ID.UNLEASHED_THUMP]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 800, coefficient: 2.3 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "might",
        duration: 6.5,
        stacks: 6,
        atMs: 800,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "fury",
        duration: 6.5,
        stacks: 1,
        atMs: 800,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 960,
  },
  [ID.HAMMER_SLAM]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 320, coefficient: 1 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 640,
  },
  [ID.UNLEASHED_WILD_SWING]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: { damageKind: "ranger-unleashed-disabled" },
      },
    ],
    quicknessCastTimeMs: 480,
  },
  [ID.HEAVY_SMASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 440,
  },
  [ID.WILD_SWING]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 400, coefficient: 1.5 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 5,
        atMs: 400,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 480,
  },
  [ID.POUNCE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        metadata: { damageKind: "ranger-pounce-defiant" },
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Leap",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "boon",
        boon: "vigor",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 840,
  },
  [ID.THUMP]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 800, coefficient: 1.25 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "control",
        atMs: 800,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: { controlKind: "knockdown", duration: 2 },
      },
    ],
    quicknessCastTimeMs: 960,
  },
  [ID.OVERBEARING_SMASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 240, coefficient: 0.4 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "control",
        atMs: 240,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: { controlKind: "daze" },
      },
      {
        type: "strike",
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        ticks: [{ atMs: 800, coefficient: 1 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "control",
        sourceId: ID.OVERBEARING_SMASH_SECOND_STRIKE,
        atMs: 800,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: { controlKind: "daze" },
      },
    ],
    quicknessCastTimeMs: 960,
  },
  [ID.SAVAGE_SHOCK_WAVE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 520, coefficient: 0.5 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "protection",
        duration: 3,
        stacks: 1,
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 4,
        atMs: 520,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 8,
        duration: 6,
        atMs: 520,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Immobilized",
        stacks: 1,
        duration: 2,
        atMs: 520,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 560,
  },
  [ID.WILD_STRIKES]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.85,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 1.7,
        hits: 1,
        name: "Wild Strikes - Final Slam Damage",
      },
    ],
    quicknessCastTimeMs: 1167,
  },
  [ID.CULTIVATE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.4,
        hits: 1,
      },
      {
        type: "boon",
        boon: "vigor",
        duration: 3,
        stacks: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 2,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.THISTLEGUARD]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
      },
      {
        type: "boon",
        boon: "stability",
        duration: 1,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.OAKEN_CUDGEL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
      {
        type: "boon",
        boon: "protection",
        duration: 4,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.FLOURISH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.85,
        hits: 1,
        name: "Flourish - Initial Damage",
      },
      {
        type: "strike",
        coefficient: 1.275,
        hits: 1,
        name: "Flourish - Delayed Damage",
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 4,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.BURGEON]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.1,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.GERMINATE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.9,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.DRAKES_SWIPE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.1,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.FALCONS_STOOP]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.95,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 4,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.PANTHERS_PROWL]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "swiftness",
        duration: 6,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.WARCLAWS_ENGAGE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.75,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.CHEETAHS_STRIKE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.8,
        hits: 1,
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.MONGOOSES_FRENZY]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 2,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 8,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.WYVERNS_LASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.4,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 2,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.MIGHTY_ROAR]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 15,
        stacks: 8,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.FORAGE_ROCK]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.RENDING_POUNCE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 4,
        duration: 6,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.INTIMIDATING_HOWL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.SHAKE_IT_OFF]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.PURGE_CONDITIONS]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.POISONOUS_CLOUD]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [1000, 2000, 3000, 4000, 5000, 6000].map((atMs) => ({
          atMs,
          coefficient: 0.2,
          metadata: {
            weaponStrength: 2880,
            independentSummonStrike: true,
            summonUsesProfessionModifiers: true,
            summonInheritsAttributes: true,
            summonInheritsCriticalAttributes: true,
          },
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "player",
      },
      {
        type: "condition",
        ticks: [1000, 2000, 3000, 4000, 5000, 6000].map((atMs) => ({
          atMs,
          condition: "Poisoned",
          stacks: 1,
          duration: 6,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger",
        actorType: "player",
      },
    ],
    quicknessCastTimeMs: 880,
    comboFields: [
      {
        ownerId: "ranger",
        fieldType: "Poison",
        duration: 5,
        startAnchor: "castEnd",
      },
    ],
    petSkill: true,
  },
  [ID.REGENERATE]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "regeneration",
        duration: 15,
        stacks: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.FIRE_BREATH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.25,
        hits: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 5,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.BOIL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.2,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.CHILLING_HOWL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.ICY_POUNCE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 2,
        duration: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.ICY_BITE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 167,
    petSkill: true,
  },
  [ID.BLINDING_SLASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.STALK]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.INSECT_SWARM]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.25,
        hits: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 5,
        duration: 4,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.POISON_CLOUD]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 4,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.PROTECTING_SCREECH]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "protection",
        duration: 4,
        stacks: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.ICY_SCREECH]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.DAZING_SCREECH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.DAZING_SCREECH_ID_12709]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.FURIOUS_SCREECH]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "fury",
        duration: 15,
        stacks: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.FROST_BREATH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.25,
        hits: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 5,
        duration: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.FROST_NOVA]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.2,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.LIGHTNING_BREATH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.6500000000000001,
        hits: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.ELECTROCUTE_ID_12699]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.POISON_CLOUD_ID_12687]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.1,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 4,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.POISONOUS_MAUL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 12,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.FEEDING_FRENZY]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "quickness",
        duration: 10,
        stacks: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.REGENERATE_ID_12717]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "regeneration",
        duration: 6,
        stacks: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.ENFEEBLING_MAUL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.ENFEEBLING_ROAR]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 4,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 833,
    petSkill: true,
  },
  [ID.ICY_ROAR]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 833,
    petSkill: true,
  },
  [ID.ICY_MAUL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.RENDING_MAUL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.34,
        hits: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 4,
        duration: 6,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true,
  },
  [ID.POISON_CLOUD_ID_12702]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.2,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.POISON_BARBS]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.65,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 4,
        duration: 6,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1667,
    petSkill: true,
  },
  [ID.LASHTAIL_VENOM]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.RENDING_BARBS]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.7999999999999998,
        hits: 6,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 6,
        duration: 8,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 2667,
    petSkill: true,
  },
  [ID.HOWL_OF_THE_PACK]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.TERRIFYING_HOWL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.CHILLING_SLASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.BRASH_SLASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.DEADLY_VENOM]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 2,
        duration: 6,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.PARALYZING_VENOM]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.WEAKENING_VENOM]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 10,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.FORAGE_SCALE]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.FORAGE_FEATHERS]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.FORAGE_SWORD]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.STUNNING_RUSH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1833,
    petSkill: true,
  },
  [ID.CHILLING_WHIRL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.6,
        hits: 4,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 4,
        duration: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1833,
    petSkill: true,
  },
  [ID.IMMOBILIZING_WHIRL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.6,
        hits: 4,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1833,
    petSkill: true,
  },
  [ID.LACERATING_SLASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 6,
        duration: 15,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 4,
        duration: 15,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.SONIC_SHRIEK]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.25,
        hits: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Confusion",
        stacks: 10,
        duration: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Confusion",
        stacks: 10,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.SONIC_BARRIER]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.SMOKE_CLOUD]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
    petSkill: true,
  },
  [ID.FURIOUS_POUNCE]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "fury",
        duration: 10,
        stacks: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.FELINE_SLASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 280, coefficient: 0.35 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 480,
    petSkill: true,
  },
  [ID.FELINE_BITE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 400, coefficient: 0.7 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
        atMs: 400,
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 800,
    petSkill: true,
  },
  [ID.FELINE_MAUL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [360, 560].map((atMs) => ({
          atMs,
          coefficient: 0.4,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 4,
        duration: 10,
        atMs: 360,
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 840,
    petSkill: true,
  },
  [ID.LIGHTNING_ASSAULT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.6,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.CONSUMING_FLAME]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.2,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1667,
    petSkill: true,
  },
  [ID.SPIKE_BARRAGE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.2,
        hits: 10,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 10,
        duration: 5,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1333,
    petSkill: true,
  },
  [ID.SAVANNAH_STRIKE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 5,
        stacks: 2,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 500,
    petSkill: true,
  },
  [ID.BLINDING_ROAR]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.0499999999999998,
        hits: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.JACARANDAS_EMBRACE]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [0, 1500, 3000, 4500, 6000].map((atMs) => ({
          atMs,
          coefficient: 0.2,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        ticks: [0, 1500, 3000, 4500, 6000].map((atMs) => ({
          atMs,
          condition: "Vulnerability",
          stacks: 1,
          duration: 8,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        ticks: [1, 2, 2, 2, 2].map((duration, index) => ({
          atMs: index * 1500,
          condition: "Immobilized",
          stacks: 1,
          duration,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 880,
    petSkill: true,
  },
  [ID.JACARANDA_ROOT_SLAP]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.4,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 800,
    petSkill: true,
  },
  [ID.JACARANDA_CALL_LIGHTNING]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [0, 1000, 2000, 3000, 4000].map((atMs) => ({
          atMs,
          coefficient: 0.5,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        ticks: [0, 1000, 2000, 3000, 4000].map((atMs) => ({
          atMs,
          condition: "Vulnerability",
          stacks: 1,
          duration: 6,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 500,
    petSkill: true,
  },
  [ID.HEAD_TOSS]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.11,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 500,
    petSkill: true,
  },
  [ID.FANG_GRAPPLE]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 1040, coefficient: 0.2 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Immobilized",
        stacks: 1,
        duration: 1,
        atMs: 1040,
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "control",
        atMs: 1040,
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
        metadata: { controlKind: "pull" },
      },
    ],
    quicknessCastTimeMs: 1000,
    petSkill: true,
  },
  [ID.GUARDIANS_ROAR]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "aegis",
        duration: 5,
        stacks: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.BLOODTHIRSTY_CHARGE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 2,
        duration: 8,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true,
  },
  [ID.GALE_BREATH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.HUNKER_DOWN]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "protection",
        duration: 2,
        stacks: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.DIMENSION_BREACH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.7,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.LEY_ENERGY_PULSE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 500,
    petSkill: true,
  },
  [ID.PANOPTICON]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 667,
    petSkill: true,
  },
  [ID.RALLYING_ROAR]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true,
  },
  [ID.HONEY_TOSS]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Slow",
        stacks: 1,
        duration: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 500,
    petSkill: true,
  },
  [ID.PIERCING_SHRIEK]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.25,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Torment",
        stacks: 2,
        duration: 8,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 500,
    petSkill: true,
  },
  [ID.INNOCENT_DISPLAY]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 3,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 1167,
    petSkill: true,
  },
  [ID.TWIN_DARTS]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 840, coefficient: 0.15 },
          { atMs: 920, coefficient: 0.15 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            chance: 0.2,
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "condition",
        ticks: [840, 920].map((atMs) => ({
          atMs,
          condition: "Bleeding",
          stacks: 2,
          duration: 2,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 880,
    petSkill: true,
  },
  [ID.PET_TAIL_LASH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 1280, coefficient: 0.5 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "control",
        atMs: 1280,
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
        metadata: { controlKind: "knockback" },
      },
    ],
    quicknessCastTimeMs: 1280,
    petSkill: true,
  },
  [ID.CONSUMING_BITE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 480, coefficient: 0.45 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 480,
    petSkill: true,
  },
  [ID.CRIPPLING_ANGUISH_PET]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 600, coefficient: 0.3 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Confusion",
        stacks: 4,
        duration: 8,
        atMs: 600,
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        condition: "Torment",
        stacks: 3,
        duration: 10,
        atMs: 600,
        timingAnchor: "castStart",
        timingScale: "fixed",
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 600,
    petSkill: true,
  },
  [ID.NARCOTIC_SPORES_PET]: {
    interruptCommitMs: 0,
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          coefficient: 0.1,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
      {
        type: "condition",
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          condition: "Confusion",
          stacks: 1,
          duration: 8,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 720,
    comboFields: [
      {
        ownerId: "ranger",
        fieldType: "Ethereal",
        duration: 6,
        startAnchor: "castEnd",
      },
    ],
    petSkill: true,
  },
  [ID.SPIT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.57,
        hits: 1,
        source: "ranger-pet",
        actorType: "summon",
      },
    ],
    quicknessCastTimeMs: 833,
    petSkill: true,
  },
});

export const RANGER_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.PATH_OF_SCARS_MAX_RANGE,
    interruptCommitMs: 0,
    name: "Path of Scars (Max Range)",
    description:
      "Throw your axe from maximum range so its returning strike lands later.",
    icon: "https://render.guildwars2.com/file/B5B27723701C39327D2145DEE76579FB007F9344/103903.png",
    variantBadge: "MAX",
    type: "Weapon",
    weapon: "Axe",
    slot: "Weapon_4",
    quicknessCastTimeMs: 440,
    rechargeAnchor: "castStart",
    cooldown: 15,
    implemented: true,
    missileHits: 2,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 400, coefficient: 1.2 },
          { atMs: 1640, coefficient: 1.2 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: "ranger",
            finisherType: "Projectile",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "control",
        atMs: 1640,
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        metadata: { controlKind: "pull" },
      },
    ],
  },
  {
    id: ID.DODGE,
    name: "Dodge",
    description: "Perform a dodge roll.",
    icon: "https://wiki.guildwars2.com/images/b/b2/Dodge.png",
    type: "Action",
    weapon: "",
    slot: "Action",
    castTimeMs: 800,
    unaffectedByQuickness: true,
    rechargeAnchor: "castStart",
    cooldown: 0,
    implemented: true,
    handlerId: "ranger.dodge",
    effects: [],
  },
  {
    id: ID.PET_SWAP,
    name: "Swap Pets",
    description: "Swap your active pet and trigger pet-swap traits.",
    icon: "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    type: "Action",
    weapon: "",
    slot: "Action",
    castTimeMs: 0,
    rechargeAnchor: "castStart",
    cooldown: 20,
    implemented: true,
    handlerId: "ranger.pet-swap",
    effects: [],
  },
  {
    id: ID.SWAP_WEAPONS,
    name: "Swap Weapons",
    description: "Swap to your alternate weapon set.",
    icon: "https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png",
    type: "Action",
    slot: "Action",
    castTimeMs: 0,
    rechargeAnchor: "castStart",
    cooldown: 10,
    implemented: true,
    handlerId: "ranger.weapon-swap",
    effects: [],
  },
]);
