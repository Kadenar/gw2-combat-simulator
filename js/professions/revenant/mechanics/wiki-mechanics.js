import {
  canonicalTargetConditionName,
} from "../../../platform/gw2/target-state.js";
import {
  WIKI_SKILL_RESEARCH,
} from "../data/revenant-wiki-skill-research.js";

const EXCLUDED_SLOTS = new Set(["downed", "drowning"]);
const CONDITION_FACTS = new Set([
  "bleeding", "burning", "chilled", "confusion", "cripple", "crippled",
  "immobile", "immobilized", "poison", "poisoned", "slow", "torment",
  "vulnerability", "weakness",
]);
const CONTROL_FACTS = new Set([
  "daze", "float", "knockback", "knockdown", "launch", "pull", "sink",
  "stun", "taunt",
]);
const BOON_FACTS = new Set([
  "aegis", "alacrity", "fury", "might", "protection", "quickness",
  "regeneration", "resolution", "resistance", "stability", "superspeed",
  "swiftness", "vigor",
]);
const LEGEND_BY_TYPE = Object.freeze({
  "legendary assassin": "LegendaryAssassin",
  "legendary demon": "LegendaryDemon",
  "legendary dwarf": "LegendaryDwarf",
  "legendary centaur": "LegendaryCentaur",
  "legendary dragon": "LegendaryDragon",
  "legendary renegade": "LegendaryRenegade",
  "legendary alliance": "LegendaryAlliance",
  "legendary entity": "LegendaryEntity",
});

function numeric(value, fallback = 0) {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}
function normalized(value) {
  return String(value || "").trim().toLowerCase();
}
function legendFor(record) {
  const type = normalized(record.type);
  for (const [fragment, id] of Object.entries(LEGEND_BY_TYPE)) {
    if (type.includes(fragment)) return id;
  }
  return "";
}
function conditionName(value) {
  const kind = normalized(value);
  if (kind === "immobile") return "Immobilized";
  return canonicalTargetConditionName(kind);
}
function isTerrestrial(record) {
  return (
    !record.page.toLowerCase().includes("(underwater)")
    && !EXCLUDED_SLOTS.has(normalized(record.slot))
  );
}
const entries = WIKI_SKILL_RESEARCH.flatMap(record =>
  record.ids.filter(() => isTerrestrial(record)).map(id => [id, record]));
export const REVENANT_WIKI_RESEARCH_BY_ID = new Map(entries);

function slotFor(record) {
  const slot = normalized(record.slot);
  if (slot === "weapon") {
    return record.weaponSlot ? `Weapon_${record.weaponSlot}` : "Action";
  }
  if (slot === "healing") return "Heal";
  if (slot === "utility") return "Utility";
  if (slot === "elite") return "Elite";
  if (slot === "mechanic") {
    return record.mechanicSlot ? `Profession_${record.mechanicSlot}` : "Action";
  }
  return "Action";
}
function typeFor(record) {
  const slot = normalized(record.slot);
  if (slot === "weapon") return "Weapon";
  if (slot === "healing") return "Heal";
  if (slot === "utility") return "Utility";
  if (slot === "elite") return "Elite";
  if (slot === "mechanic") return "Profession";
  return "Action";
}
function actorTypeFor(record) {
  const page = normalized(record.page);
  if (
    page.includes("razor")
    || page.includes("soulcleave")
    || page.includes("warband")
  ) return "summon";
  return "player";
}
function firstCount(record, names) {
  const fact = record.facts.find(candidate => {
    const kind = normalized(candidate.kind);
    const label = normalized(candidate.label);
    return names.some(name => kind.includes(name) || label.includes(name));
  });
  return Math.max(0, Math.trunc(numeric(fact?.values?.[0], 0)));
}
function damageEffects(record, castTimeMs) {
  const facts = record.facts.filter(fact =>
    ["damage", "life siphon damage"].includes(normalized(fact.kind))
    && Number.isFinite(Number(fact.coefficient))
    && !normalized(fact.label).includes("minimum"));
  const count = Math.max(
    1,
    firstCount(record, [
      "number of hits", "number of impacts", "pulses", "pulse",
    ]),
  );
  return facts.map((fact, index) => {
    let hits = Math.max(1, Math.trunc(Number(fact.strikes || 0)));
    if (hits === 1 && facts.length === 1) hits = count;
    const effect = {
      type: "strike",
      coefficient: Number(fact.coefficient) * hits,
      hits,
      name: fact.label || (
        facts.length > 1 ? `${record.page} — Packet ${index + 1}` : record.page
      ),
      actorType: actorTypeFor(record),
    };
    if (hits > 1 && castTimeMs > 0) {
      effect.atMs = Math.round(castTimeMs / hits);
      effect.intervalMs = Math.max(1, Math.round(castTimeMs / hits));
      effect.timingAnchor = "castStart";
      effect.timingScale = "cast";
    }
    return effect;
  });
}
function conditionEffects(record) {
  return record.facts.filter(fact =>
    CONDITION_FACTS.has(normalized(fact.kind))).map(fact => {
    const duration = numeric(fact.values?.[0], 0);
    if (!(duration > 0)) return null;
    return {
      type: "condition",
      condition: conditionName(fact.kind),
      stacks: Math.max(1, Number(fact.stacks || 1)),
      duration,
      actorType: actorTypeFor(record),
    };
  }).filter(Boolean);
}
function otherEffects(record) {
  const effects = [];
  for (const fact of record.facts) {
    const kind = normalized(fact.kind);
    if (kind === "blind" || kind === "blinded") {
      effects.push({ type: "blind", actorType: actorTypeFor(record) });
    } else if (CONTROL_FACTS.has(kind)) {
      effects.push({
        type: "control",
        actorType: actorTypeFor(record),
        metadata: {
          controlKind: kind,
          duration: Math.max(0, numeric(fact.values?.[0], 0)),
        },
      });
    } else if (BOON_FACTS.has(kind)) {
      const duration = numeric(fact.values?.[0], 0);
      if (duration > 0) {
        effects.push({
          type: "boon",
          boon: fact.kind,
          duration,
          stacks: Math.max(1, Number(fact.stacks || 1)),
        });
      }
    }
  }
  return effects;
}

export function revenantMechanicsFromResearch(record) {
  const castTimeMs = Math.max(0, Math.round(numeric(record.activation) * 1000));
  return {
    implemented: true,
    castTimeMs,
    cooldown: Math.max(0, numeric(record.recharge)),
    ammo: Math.max(0, Math.trunc(numeric(record.ammo))),
    energyCost: Math.max(0, numeric(record.energy)),
    upkeepCost: Math.abs(Math.min(0, numeric(record.upkeep))),
    rechargeAnchor: "castEnd",
    timingConfidence: record.activation ? "wiki" : "estimated",
    sourceUrl: record.sourceUrl,
    sourceRevisionId: record.revisionId,
    sourceRevisionDate: String(record.revisionTimestamp || "").slice(0, 10),
    pveMode: true,
    actorType: actorTypeFor(record),
    effects: [
      ...damageEffects(record, castTimeMs),
      ...conditionEffects(record),
      ...otherEffects(record),
    ],
  };
}

export function revenantSupplementalSkill(record, id) {
  const legendId = legendFor(record);
  const type = normalized(record.type);
  const page = normalized(record.page);
  return {
    id: Number(id),
    name: record.page,
    description: record.description,
    icon: "",
    type: typeFor(record),
    slot: slotFor(record),
    weapon: record.weapon,
    specialization: record.specialization
      ? record.specialization[0].toUpperCase() + record.specialization.slice(1)
      : "",
    categories: String(record.type || "").split(",").map(value => value.trim())
      .filter(Boolean),
    flags: ["NoUnderwater"],
    recharge: Math.max(0, numeric(record.recharge)),
    ammo: Math.max(0, Math.trunc(numeric(record.ammo))),
    ammoRecharge: Math.max(0, numeric(record.recharge)),
    nextChainId: null,
    flipSkillId: null,
    legendId,
    energyCost: Math.max(0, numeric(record.energy)),
    upkeepCost: Math.abs(Math.min(0, numeric(record.upkeep))),
    facet: type.includes("facet") && !type.includes("consume"),
    consume: type.includes("consume"),
    allianceSide:
      ["selfish spirit", "nomad's advance", "scavenger burst",
        "reaver's rage", "spear of archemorus"].includes(page)
        ? "luxon"
        : ["selfless spirit", "battle dance", "tree song",
            "awakening", "urn of saint viktor"].includes(page)
          ? "kurzick"
          : "",
    simulatorExcluded: false,
  };
}

