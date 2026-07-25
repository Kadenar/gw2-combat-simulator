import { NECROMANCER_SKILL_IDS as ID } from "./ids.js";
import { SKILLS } from "./data/necromancer-catalog.js";
import {
  NECROMANCER_SUPPLEMENTAL_SKILLS,
} from "./data/necromancer-supplemental-skills.js";

const ALL_API_SKILLS = Object.freeze([
  ...SKILLS,
  ...NECROMANCER_SUPPLEMENTAL_SKILLS,
]);

const strike = (
  coefficient,
  {
    hits = 1,
    atMs,
    intervalMs,
    name,
    source,
    actorType,
    metadata,
  } = {},
) => ({
  type: "strike",
  coefficient,
  hits,
  ...(atMs == null ? {} : { atMs }),
  ...(intervalMs == null ? {} : { intervalMs }),
  ...(name ? { name } : {}),
  ...(source ? { source } : {}),
  ...(actorType ? { actorType } : {}),
  ...(metadata ? { metadata } : {}),
});

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

const condition = (
  conditionName,
  stacks,
  duration,
  atMs,
  metadata,
) => ({
  type: "condition",
  condition: conditionName,
  stacks,
  duration,
  ...(atMs == null ? {} : { atMs }),
  ...(metadata ? { metadata } : {}),
});

const control = (kind = "control", atMs) => ({
  type: "control",
  ...(atMs == null ? {} : { atMs }),
  metadata: { controlKind: kind },
});

const custom = (eventType, atMs, event = {}) => ({
  type: "custom",
  eventType,
  ...(atMs == null ? {} : { atMs }),
  event,
});

const repeatedCondition = (
  name,
  {
    count,
    duration,
    firstAtMs = 0,
    intervalMs = 1000,
    stacks = 1,
  },
) => Array.from(
  { length: count },
  (_, index) => condition(
    name,
    stacks,
    duration,
    firstAtMs + index * intervalMs,
  ),
);

const implemented = definition => ({
  implemented: true,
  ...definition,
  activation:
    definition.activation
    ?? Math.max(0, Number(definition.castTimeMs || 0)) / 1000,
});

function factValue(skill, predicate) {
  return (skill.facts || []).find(predicate);
}

function inferredCastTimeMs(skill) {
  if (skill.type === "Profession") return 0;
  if (skill.type === "Weapon") {
    return skill.slot === "Weapon_1" ? 500 : 750;
  }
  if (skill.type === "Heal") return 1000;
  if (skill.type === "Elite") return 1000;
  return 500;
}

function inferredDamageFacts(skill) {
  const facts = [...(skill.apiDamage || [])];
  if (!facts.length) return [];
  const conditional = facts.filter(fact =>
    /\b(?:below|above|with|minimum|maximum|boons? removed)\b/i
      .test(String(fact.text || "")));
  if (conditional.length === facts.length) {
    return [facts.reduce((best, fact) =>
      Number(fact.coefficient) < Number(best.coefficient) ? fact : best)];
  }
  const selected = [];
  const seen = new Set();
  for (const fact of facts) {
    if (
      /^Minimum Damage$/i.test(String(fact.text || ""))
      || conditional.includes(fact)
    ) continue;
    const key = String(fact.text || "Damage");
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(fact);
  }
  return selected.length ? selected : [facts[0]];
}

function uniqueApiConditions(skill) {
  const seen = new Set();
  return (skill.apiConditions || []).filter(fact => {
    const key = `${fact.condition}:${fact.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferredEffects(skill) {
  const effects = [];
  const persistent = (
    skill.categories?.includes("Well")
    || /\b(?:pulse|pulses|over time|swarm)\b/i.test(skill.description || "")
  );
  for (const fact of inferredDamageFacts(skill)) {
    effects.push(strike(Number(fact.coefficient || 0), {
      hits: Math.max(1, Number(fact.hits || 1)),
      intervalMs:
        persistent && Number(fact.hits || 1) > 1 ? 1000 : undefined,
      name: fact.text && fact.text !== "Damage"
        ? `${skill.name} — ${fact.text}`
        : undefined,
    }));
  }
  for (const fact of uniqueApiConditions(skill)) {
    if (!(Number(fact.duration) > 0) || !(Number(fact.stacks) > 0)) continue;
    effects.push(condition(
      fact.condition,
      Number(fact.stacks),
      Number(fact.duration),
    ));
  }

  const statusFacts = (skill.facts || []).filter(fact =>
    fact.type === "Buff" && Number(fact.duration) > 0);
  const statuses = new Set(statusFacts.map(fact => fact.status));
  if (statuses.has("Blinded")) effects.push({ type: "blind" });
  if (
    statuses.has("Fear")
    || (skill.facts || []).some(fact =>
      ["Stun", "Daze", "Knockdown", "Knockback", "Float"]
        .some(kind => String(fact.text || "").startsWith(kind)))
  ) {
    effects.push(control(statuses.has("Fear") ? "fear" : "control"));
  }
  for (const chilled of statusFacts.filter(fact => fact.status === "Chilled")) {
    effects.push(custom("necromancer.chill", undefined, {
      duration: Number(chilled.duration),
    }));
    break;
  }
  for (
    const vulnerability of statusFacts
      .filter(fact => fact.status === "Vulnerability")
      .slice(0, 1)
  ) {
    effects.push({
      type: "buff",
      kind: "target-vulnerability",
      stacks: Math.max(1, Number(vulnerability.apply_count || 1)),
      duration: Number(vulnerability.duration),
    });
  }
  return effects;
}

function inferredLifeForceGain(skill) {
  const fact = factValue(skill, candidate =>
    candidate.type === "Percent"
    && /^Life Force(?! Cost)/i.test(String(candidate.text || "")));
  return Math.max(0, Number(fact?.percent || 0));
}

const SHROUD_SKILLS = Object.freeze({
  [ID.LIFE_BLAST]: ["death", 1],
  [ID.DHUUMFIRE_BLAST]: ["death", 1],
  [ID.DARK_PATH]: ["death", 2],
  [ID.DARK_PURSUIT]: ["death", 2],
  [ID.DOOM]: ["death", 3],
  [ID.LIFE_TRANSFER]: ["death", 4],
  [ID.TAINTED_SHACKLES]: ["death", 5],

  [ID.LIFE_REND]: ["reaper", 1],
  [ID.LIFE_SLASH]: ["reaper", 1],
  [ID.LIFE_REAP]: ["reaper", 1],
  [ID.DEATHS_CHARGE]: ["reaper", 2],
  [ID.INFUSING_TERROR]: ["reaper", 3],
  [ID.TERRIFY]: ["reaper", 3],
  [ID.SOUL_SPIRAL]: ["reaper", 4],
  [ID.EXECUTIONERS_SCYTHE]: ["reaper", 5],

  [ID.TAINTED_BOLTS]: ["harbinger", 1],
  [ID.DARK_BARRAGE]: ["harbinger", 2],
  [ID.DEVOURING_CUT]: ["harbinger", 3],
  [ID.VORACIOUS_ARC]: ["harbinger", 4],
  [ID.VITAL_DRAW]: ["harbinger", 5],

  [ID.ESSENCE_BLAST]: ["ritualist", 1],
  [ID.ANGUISH]: ["ritualist", 2],
  [ID.WANDERLUST]: ["ritualist", 3],
  [ID.PRESERVATION]: ["ritualist", 4],
  [ID.SUMMON_SPIRITS]: ["ritualist", 5],
});

const LIFE_FORCE_OVERRIDES = Object.freeze({
  10528: 12,
  10529: 5,
  10557: 1.5,
  10590: 10,
  10596: 4,
  10608: 4,
  10620: 15,
  10703: 4,
  10704: 8,
  10709: 8,
  19115: 0,
  19116: 0,
  19117: 0,
  29705: 2,
  29740: 10,
  29855: 7,
  29867: 5,
  30278: 1.5,
  30488: 15,
  30799: 2,
  42297: 0,
  42935: 12,
  44946: 0,
  45846: 5,
  46473: 0,
  46474: 0,
  51647: 8,
  55050: 11,
  62511: 4,
  62513: 9,
  62563: 3,
  71883: 12,
  71998: 10,
  73007: 12,
  73013: 10,
  73047: 5,
});

const INFERRED_MECHANICS = Object.freeze(Object.fromEntries(
  ALL_API_SKILLS.map(skill => {
    const shroud = SHROUD_SKILLS[skill.id];
    const lifeForceGain =
      LIFE_FORCE_OVERRIDES[skill.id] ?? inferredLifeForceGain(skill);
    return [skill.id, implemented({
      castTimeMs: inferredCastTimeMs(skill),
      effects: inferredEffects(skill),
      ...(lifeForceGain > 0 ? { lifeForceGain } : {}),
      ...(shroud ? {
        type: "Profession",
        slot: `Weapon_${shroud[1]}`,
        shroud: shroud[0],
        shroudSlot: shroud[1],
        specialization: {
          reaper: "Reaper",
          harbinger: "Harbinger",
          ritualist: "Ritualist",
        }[shroud[0]] || "",
      } : {}),
    })];
  }),
));

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
    ...INFERRED_MECHANICS[id],
    handlerId: "necromancer.minion",
    effects: [],
  });
}
for (const id of MINION_COMMAND_IDS) {
  HANDLER_OVERRIDES[id] = implemented({
    ...INFERRED_MECHANICS[id],
    handlerId: "necromancer.minion-command",
    effects: [],
  });
}

const MECHANICAL_OVERRIDES = Object.freeze({
  ...HANDLER_OVERRIDES,

  10557: implemented({
    castTimeMs: 750,
    lifeForceGain: 1.5,
    effects: Array.from(
      { length: 10 },
      (_, index) => lifeSteal(37, 0.012, {
        atMs: index * 500,
        name: "Locust Swarm — Life Siphon",
      }),
    ),
  }),
  [ID.SIGNET_OF_UNDEATH]: implemented({
    ...INFERRED_MECHANICS[ID.SIGNET_OF_UNDEATH],
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
      strike(1.625, { atMs: 1250, name: "Death's Charge — Final Strike" }),
      { type: "blind" },
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
    ...INFERRED_MECHANICS[42297],
    simulatorAliasOfId: ID.MANIFEST_SAND_SHADE,
    simulatorExcluded: true,
    flipSkillId: null,
  }),
  [46473]: implemented({
    ...INFERRED_MECHANICS[46473],
    simulatorAliasOfId: ID.MANIFEST_SAND_SHADE,
    simulatorExcluded: true,
    flipSkillId: null,
  }),
  [46474]: implemented({
    ...INFERRED_MECHANICS[46474],
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
        name: "Grim Specter — Life Steal",
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
    ...INFERRED_MECHANICS[ID.FEAST_OF_CORRUPTION],
    flipSkillId: null,
  }),
  [ID.DEVOURING_DARKNESS]: implemented({
    ...INFERRED_MECHANICS[ID.DEVOURING_DARKNESS],
    flipParentId: null,
  }),
});

export const NECROMANCER_SKILL_MECHANICS = Object.freeze(
  Object.fromEntries(
    [...new Set([
      ...Object.keys(INFERRED_MECHANICS),
      ...Object.keys(MECHANICAL_OVERRIDES),
    ])].map(id => {
      const definition = {
        ...(INFERRED_MECHANICS[id] || {}),
        ...(MECHANICAL_OVERRIDES[id] || {}),
      };
      return [id, {
        ...definition,
        activation: Math.max(
          0,
          Number(definition.castTimeMs || 0),
        ) / 1000,
      }];
    }),
  ),
);

export const NECROMANCER_AUTOATTACK_CHAINS = Object.freeze([
  [10698, 10699, 10552],
  [10702, 10703, 10704],
  [29705, 30799, 29867],
  [73012, 73040, 73047],
  [ID.ENERVATION_BLADE, ID.ENERVATION_ECHO],
  [ID.LIFE_REND, ID.LIFE_SLASH, ID.LIFE_REAP],
].map(chain => Object.freeze(chain)));

export const NECROMANCER_MINION_SUMMON_IDS = Object.freeze(
  [...MINION_SUMMON_IDS],
);
export const NECROMANCER_MINION_COMMAND_IDS = Object.freeze(
  [...MINION_COMMAND_IDS],
);

export { condition, control, custom, lifeSteal, strike };
