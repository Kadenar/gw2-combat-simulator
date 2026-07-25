/**
 * Hand-authored exceptions to Necromancer skill defaults.
 *
 * Final composition belongs in skill-mechanics.js.
 */

import { NECROMANCER_SKILL_IDS as ID } from "../data/ids.js";
import {
  blind,
  condition,
  control,
  custom,
  repeatedCondition,
  strike,
} from "../../../platform/engine/effect-factories.js";
import {
  implemented as implementedSkill,
} from "../../../platform/engine/skill-factories.js";
import {
  NECROMANCER_SKILL_DEFAULTS,
} from "./skill-defaults.js";

const lifeSteal = (
  flatStrikeBase,
  flatStrikePowerCoeff,
  options = {},
) => strike(0, {
  ...options,
  metadata: {
    flatStrikeBase,
    flatStrikePowerCoeff,
    noCrit: true,
    damageKind: "life-steal",
    ...(options.metadata || {}),
  },
});

const implemented = definition => implementedSkill({
  ...definition,
  activation:
    definition.activation
    ?? Math.max(0, Number(definition.castTimeMs || 0)) / 1000,
});

const MINION_SUMMON_IDS = new Set([
  ID.SUMMON_BONE_FIEND,
  ID.SUMMON_BONE_MINIONS,
  ID.SUMMON_FLESH_WURM,
  ID.SUMMON_BLOOD_FIEND,
  ID.SUMMON_SHADOW_FIEND,
  ID.SUMMON_FLESH_GOLEM,
]);
const MINION_COMMAND_IDS = new Set([
  ID.RIGOR_MORTIS,
  ID.PUTRID_EXPLOSION,
  ID.NECROTIC_TRAVERSAL,
  ID.TASTE_OF_DEATH,
  ID.HAUNT,
  ID.CHARGE,
]);

const HANDLER_OVERRIDES = {};
for (const id of MINION_SUMMON_IDS) {
  HANDLER_OVERRIDES[id] = implemented({
    ...NECROMANCER_SKILL_DEFAULTS[id],
    handlerId: "necromancer.minion",
    effects: [],
  });
}
for (const id of MINION_COMMAND_IDS) {
  HANDLER_OVERRIDES[id] = implemented({
    ...NECROMANCER_SKILL_DEFAULTS[id],
    handlerId: "necromancer.minion-command",
    effects: [],
  });
}

export const NECROMANCER_SKILL_OVERRIDES = Object.freeze({
  ...HANDLER_OVERRIDES,

  10557: implemented({
    castTimeMs: 750,
    lifeForceGain: 1.5,
    effects: Array.from(
      { length: 10 },
      (_, index) => lifeSteal(37, 0.012, {
        atMs: index * 500,
        name: "Locust Swarm â€” Life Siphon",
      }),
    ),
  }),
  [ID.SIGNET_OF_UNDEATH]: implemented({
    ...NECROMANCER_SKILL_DEFAULTS[ID.SIGNET_OF_UNDEATH],
    lifeForceGain: 0,
    handlerId: "necromancer.signet-undeath",
    effects: [],
  }),
  [ID.SUMMON_FLESH_WURM]: implemented({
    ...HANDLER_OVERRIDES[ID.SUMMON_FLESH_WURM],
    flipSkillId: ID.NECROTIC_TRAVERSAL,
  }),
  [ID.NECROTIC_TRAVERSAL]: implemented({
    ...HANDLER_OVERRIDES[ID.NECROTIC_TRAVERSAL],
    castTimeMs: 0,
    lifeForceGain: 10,
    effects: [],
  }),
  [ID.DEATH_SHROUD]: implemented({
    castTimeMs: 0,
    cooldown: 10,
    handlerId: "necromancer.shroud",
    effects: [],
  }),
  [ID.END_DEATH_SHROUD]: implemented({
    castTimeMs: 0,
    cooldown: 0,
    handlerId: "necromancer.shroud",
    effects: [],
  }),
  [ID.REAPERS_SHROUD]: implemented({
    castTimeMs: 0,
    cooldown: 10,
    specialization: "Reaper",
    handlerId: "necromancer.shroud",
    effects: [],
  }),
  [ID.EXIT_REAPERS_SHROUD]: implemented({
    castTimeMs: 0,
    cooldown: 0,
    specialization: "Reaper",
    handlerId: "necromancer.shroud",
    effects: [],
  }),
  [ID.HARBINGER_SHROUD]: implemented({
    castTimeMs: 0,
    cooldown: 10,
    specialization: "Harbinger",
    handlerId: "necromancer.shroud",
    effects: [],
  }),
  [ID.EXIT_HARBINGER_SHROUD]: implemented({
    castTimeMs: 0,
    cooldown: 0,
    specialization: "Harbinger",
    handlerId: "necromancer.shroud",
    effects: [],
  }),
  [ID.RITUALISTS_SHROUD]: implemented({
    castTimeMs: 0,
    cooldown: 10,
    specialization: "Ritualist",
    handlerId: "necromancer.shroud",
    effects: [],
  }),
  [ID.EXIT_RITUALISTS_SHROUD]: implemented({
    castTimeMs: 0,
    cooldown: 0,
    specialization: "Ritualist",
    handlerId: "necromancer.shroud",
    effects: [],
  }),

  [ID.LIFE_BLAST]: implemented({
    castTimeMs: 1000,
    type: "Profession",
    slot: "Weapon_1",
    shroud: "death",
    shroudSlot: 1,
    flipSkillId: null,
    effects: [strike(1.4)],
  }),
  [ID.DHUUMFIRE_BLAST]: implemented({
    castTimeMs: 1000,
    type: "Profession",
    slot: "Weapon_1",
    shroud: "death",
    shroudSlot: 1,
    flipParentId: null,
    simulatorExcluded: true,
    effects: [strike(1.4), condition("Burning", 1, 3)],
  }),
  [ID.DARK_PATH]: implemented({
    castTimeMs: 750,
    shroud: "death",
    shroudSlot: 2,
    handlerId: "necromancer.flip",
    effects: [
      strike(0.25),
      condition("Bleeding", 2, 8),
      custom("necromancer.chill", undefined, { duration: 3 }),
    ],
  }),
  [ID.DARK_PURSUIT]: implemented({
    castTimeMs: 0,
    cooldown: 0,
    shroud: "death",
    shroudSlot: 2,
    effects: [],
  }),
  [ID.DOOM]: implemented({
    castTimeMs: 750,
    shroud: "death",
    shroudSlot: 3,
    effects: [strike(0.1), control("fear")],
  }),
  [ID.LIFE_TRANSFER]: implemented({
    castTimeMs: 2000,
    shroud: "death",
    shroudSlot: 4,
    lifeForceGain: 9,
    effects: [
      strike(3.825, { hits: 9, atMs: 222, intervalMs: 222 }),
      ...repeatedCondition("Bleeding", {
        count: 9,
        duration: 3,
        firstAtMs: 222,
        intervalMs: 222,
      }),
    ],
  }),
  [ID.TAINTED_SHACKLES]: implemented({
    castTimeMs: 250,
    shroud: "death",
    shroudSlot: 5,
    effects: [
      ...repeatedCondition("Torment", {
        count: 4,
        stacks: 2,
        duration: 12,
        firstAtMs: 250,
        intervalMs: 1000,
      }),
      strike(1.25, { atMs: 4250 }),
    ],
  }),

  [ID.LIFE_REND]: implemented({
    castTimeMs: 500,
    effects: [strike(1.4)],
  }),
  [ID.LIFE_SLASH]: implemented({
    castTimeMs: 500,
    effects: [strike(1.6)],
  }),
  [ID.LIFE_REAP]: implemented({
    castTimeMs: 500,
    lifeForceGain: 1.5,
    effects: [strike(1.8)],
  }),
  [ID.DEATHS_CHARGE]: implemented({
    castTimeMs: 1250,
    effects: [
      strike(2.25, { hits: 9, atMs: 100, intervalMs: 100 }),
      strike(1.625, { atMs: 1250, name: "Death's Charge â€” Final Strike" }),
      blind(),
    ],
  }),
  [ID.INFUSING_TERROR]: implemented({
    castTimeMs: 0,
    handlerId: "necromancer.flip",
    effects: [],
  }),
  [ID.TERRIFY]: implemented({
    castTimeMs: 500,
    cooldown: 0,
    effects: [control("fear")],
  }),
  [ID.SOUL_SPIRAL]: implemented({
    castTimeMs: 2750,
    effects: [
      strike(8.4, { hits: 12, atMs: 229, intervalMs: 229 }),
      ...repeatedCondition("Poisoned", {
        count: 12,
        duration: 2,
        firstAtMs: 229,
        intervalMs: 229,
      }),
    ],
  }),
  [ID.EXECUTIONERS_SCYTHE]: implemented({
    castTimeMs: 1250,
    effects: [
      strike(4, {
        metadata: {
          thresholdCoefficients: { 50: 6, 25: 8 },
        },
      }),
      control("stun"),
      custom("necromancer.chill", undefined, { duration: 1 }),
    ],
  }),

  [ID.MANIFEST_SAND_SHADE]: implemented({
    castTimeMs: 500,
    cooldown: 15,
    ammo: 3,
    ammoRecharge: 15,
    specialization: "Scourge",
    handlerId: "necromancer.shade",
    effects: [],
  }),
  [42297]: implemented({
    ...NECROMANCER_SKILL_DEFAULTS[42297],
    simulatorAliasOfId: ID.MANIFEST_SAND_SHADE,
    simulatorExcluded: true,
    flipSkillId: null,
  }),
  [46473]: implemented({
    ...NECROMANCER_SKILL_DEFAULTS[46473],
    simulatorAliasOfId: ID.MANIFEST_SAND_SHADE,
    simulatorExcluded: true,
    flipSkillId: null,
  }),
  [46474]: implemented({
    ...NECROMANCER_SKILL_DEFAULTS[46474],
    simulatorAliasOfId: ID.MANIFEST_SAND_SHADE,
    simulatorExcluded: true,
    flipSkillId: null,
  }),
  [ID.NEFARIOUS_FAVOR]: implemented({
    castTimeMs: 0,
    specialization: "Scourge",
    lifeForceCost: 21,
    handlerId: "necromancer.shade",
    effects: [],
  }),
  [ID.SAND_CASCADE]: implemented({
    castTimeMs: 0,
    specialization: "Scourge",
    lifeForceCost: 27,
    handlerId: "necromancer.shade",
    effects: [],
  }),
  [ID.GARISH_PILLAR]: implemented({
    castTimeMs: 0,
    specialization: "Scourge",
    lifeForceCost: 40,
    handlerId: "necromancer.shade",
    effects: [],
  }),
  [ID.DESERT_SHROUD]: implemented({
    castTimeMs: 0,
    specialization: "Scourge",
    lifeForceCost: 50,
    handlerId: "necromancer.shade",
    flipSkillId: null,
    effects: [],
  }),
  [ID.SANDSTORM_SHROUD]: implemented({
    castTimeMs: 0,
    specialization: "Scourge",
    lifeForceCost: 35,
    handlerId: "necromancer.shade",
    flipParentId: null,
    effects: [],
  }),

  [ID.TAINTED_BOLTS]: implemented({
    castTimeMs: 500,
    effects: [
      strike(1.2, { hits: 2, atMs: 250, intervalMs: 250 }),
      condition("Torment", 1, 3),
    ],
  }),
  [ID.DARK_BARRAGE]: implemented({
    castTimeMs: 750,
    effects: [
      strike(3.6, { hits: 6, atMs: 125, intervalMs: 125 }),
      ...repeatedCondition("Torment", {
        count: 6,
        duration: 3,
        firstAtMs: 125,
        intervalMs: 125,
      }),
    ],
  }),
  [ID.DEVOURING_CUT]: implemented({
    castTimeMs: 1000,
    handlerId: "necromancer.blight-skill",
    effects: [],
  }),
  [ID.VORACIOUS_ARC]: implemented({
    castTimeMs: 750,
    handlerId: "necromancer.blight-skill",
    effects: [],
  }),
  [ID.VITAL_DRAW]: implemented({
    castTimeMs: 1000,
    lifeForceGain: 3,
    effects: [
      strike(1.2, { hits: 3, atMs: 333, intervalMs: 333 }),
      control("float"),
    ],
  }),

  [ID.ESSENCE_BLAST]: implemented({
    castTimeMs: 750,
    handlerId: "necromancer.ritualist",
    effects: [],
  }),
  [ID.ANGUISH]: implemented({
    castTimeMs: 500,
    handlerId: "necromancer.ritualist",
    effects: [],
  }),
  [ID.WANDERLUST]: implemented({
    castTimeMs: 1000,
    handlerId: "necromancer.ritualist",
    effects: [],
  }),
  [ID.PRESERVATION]: implemented({
    castTimeMs: 500,
    handlerId: "necromancer.ritualist",
    effects: [],
  }),
  [ID.SUMMON_SPIRITS]: implemented({
    castTimeMs: 0,
    handlerId: "necromancer.ritualist",
    effects: [],
  }),
  [ID.INNERVATE_ANGUISH]: implemented({
    castTimeMs: 0,
    handlerId: "necromancer.innervate",
    effects: [],
  }),
  [ID.INNERVATE_WANDERLUST]: implemented({
    castTimeMs: 0,
    handlerId: "necromancer.innervate",
    effects: [],
  }),
  [ID.INNERVATE_PRESERVATION]: implemented({
    castTimeMs: 0,
    handlerId: "necromancer.innervate",
    effects: [],
  }),

  [ID.LICH_FORM]: implemented({
    castTimeMs: 1000,
    cooldown: 120,
    handlerId: "necromancer.lich",
    effects: [],
  }),
  [ID.DEATHLY_CLAWS]: implemented({
    castTimeMs: 1100,
    effects: [strike(2.34), condition("Bleeding", 3, 3)],
  }),
  [ID.LICHS_GAZE]: implemented({
    castTimeMs: 0,
    cooldown: 8,
    effects: [
      strike(1),
      custom("necromancer.chill", undefined, { duration: 4 }),
    ],
  }),
  [ID.RIPPLE_OF_HORROR]: implemented({
    castTimeMs: 500,
    handlerId: "necromancer.flip",
    effects: [strike(1), control("fear")],
  }),
  [ID.MARCH_OF_UNDEATH]: implemented({
    castTimeMs: 0,
    effects: [],
  }),
  [ID.SUMMON_MADNESS]: implemented({
    castTimeMs: 1500,
    handlerId: "necromancer.summon-madness",
    effects: [],
  }),
  [ID.GRIM_SPECTER]: implemented({
    castTimeMs: 750,
    effects: Array.from({ length: 5 }, (_, index) =>
      lifeSteal(778, 0.2, {
        atMs: 750 + index * 1000,
        name: "Grim Specter â€” Life Steal",
      })),
  }),

  [ID.ELIXIR_OF_PROMISE]: implemented({
    castTimeMs: 500,
    handlerId: "necromancer.elixir",
    effects: [],
  }),
  [ID.ELIXIR_OF_RISK]: implemented({
    castTimeMs: 500,
    cooldown: 20,
    handlerId: "necromancer.elixir",
    effects: [],
  }),
  [ID.ELIXIR_OF_BLISS]: implemented({
    castTimeMs: 500,
    handlerId: "necromancer.elixir",
    effects: [],
  }),
  [ID.ELIXIR_OF_IGNORANCE]: implemented({
    castTimeMs: 500,
    handlerId: "necromancer.elixir",
    effects: [],
  }),
  [ID.ELIXIR_OF_ANGUISH]: implemented({
    castTimeMs: 500,
    handlerId: "necromancer.elixir",
    effects: [],
  }),
  [ID.ELIXIR_OF_AMBITION]: implemented({
    castTimeMs: 500,
    handlerId: "necromancer.elixir",
    effects: [],
  }),
  [ID.SIGNET_OF_VAMPIRISM]: implemented({
    castTimeMs: 1000,
    handlerId: "necromancer.signet-vampirism",
    effects: [],
  }),

  [ID.FEAST_OF_CORRUPTION]: implemented({
    ...NECROMANCER_SKILL_DEFAULTS[ID.FEAST_OF_CORRUPTION],
    flipSkillId: null,
  }),
  [ID.DEVOURING_DARKNESS]: implemented({
    ...NECROMANCER_SKILL_DEFAULTS[ID.DEVOURING_DARKNESS],
    flipParentId: null,
  }),
});

export const NECROMANCER_MINION_SUMMON_IDS = Object.freeze(
  [...MINION_SUMMON_IDS],
);
export const NECROMANCER_MINION_COMMAND_IDS = Object.freeze(
  [...MINION_COMMAND_IDS],
);
