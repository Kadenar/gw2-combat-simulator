import {
  canonicalTargetConditionName,
} from "../../../platform/gw2/target-state.js";
import {
  WIKI_SKILL_RESEARCH,
} from "../data/engineer-wiki-skill-research.js";

const AQUATIC_SKILL_IDS = new Set([
  6020,
  6145,
  6147,
  6148,
  6149,
  50380,
  50438,
  50441,
]);
const EXCLUDED_SLOTS = new Set(["downed", "drowning"]);
const CONDITION_FACTS = new Set([
  "bleeding",
  "burning",
  "chilled",
  "confusion",
  "crippled",
  "fear",
  "immobilized",
  "poison",
  "poisoned",
  "slow",
  "torment",
  "vulnerability",
  "weakness",
]);
const CONTROL_FACTS = new Set([
  "daze",
  "float",
  "knockback",
  "knockdown",
  "launch",
  "pull",
  "sink",
  "stun",
  "taunt",
]);
const BOON_FACTS = new Set([
  "aegis",
  "alacrity",
  "fury",
  "might",
  "protection",
  "quickness",
  "regeneration",
  "resolution",
  "resistance",
  "stability",
  "superspeed",
  "swiftness",
  "vigor",
]);

function numeric(value, fallback = 0) {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

export function isTerrestrialEngineerResearch(record, id) {
  return (
    !AQUATIC_SKILL_IDS.has(Number(id))
    && !record.page.toLowerCase().includes("(underwater)")
    && !EXCLUDED_SLOTS.has(normalized(record.slot))
  );
}

const researchEntries = WIKI_SKILL_RESEARCH.flatMap(record =>
  record.ids
    .filter(id => isTerrestrialEngineerResearch(record, id))
    .map(id => [id, record]));

export const ENGINEER_WIKI_RESEARCH_BY_ID = new Map(researchEntries);

function slotForResearch(record, id) {
  const slot = normalized(record.slot);
  if (slot === "weapon" || slot === "engineering kit" || slot === "transform") {
    return record.weaponSlot ? `Weapon_${record.weaponSlot}` : "Action";
  }
  if (slot === "healing") return "Heal";
  if (slot === "utility") return "Utility";
  if (slot === "elite") return "Elite";
  if (slot === "mechanic") {
    const morphSlot = normalized(record.type).includes("morph")
      ? record.ids.indexOf(Number(id)) + 2
      : 0;
    const mechanicSlot = record.mechanicSlot || morphSlot;
    return mechanicSlot ? `Profession_${mechanicSlot}` : "Action";
  }
  return "Action";
}

function typeForResearch(record) {
  const slot = normalized(record.slot);
  if (slot === "weapon" || slot === "engineering kit" || slot === "transform") {
    return "Weapon";
  }
  if (slot === "healing") return "Heal";
  if (slot === "utility") return "Utility";
  if (slot === "elite") return "Elite";
  if (slot === "mechanic") return "Profession";
  return "Action";
}

function categoriesForResearch(record) {
  return [...new Set([
    ...String(record.type || "").split(",").map(value => value.trim()),
    ...(record.kit ? ["EngineeringKit"] : []),
    ...(record.specialization ? [record.specialization] : []),
  ].filter(Boolean))];
}

function actorTypeFor(record) {
  const page = record.page.toLowerCase();
  const type = normalized(record.type);
  if (
    type.includes("turret")
    || page.includes("mech")
    || page.includes("jade energy shot")
    || page.includes("rolling smash")
    || page.includes("twin strike")
    || page.includes("heavy smash")
  ) return "summon";
  if (type.includes("well") || type.includes("gyro")) return "effect";
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
    normalized(fact.kind) === "damage"
    && Number.isFinite(Number(fact.coefficient))
    && !normalized(fact.label).includes("minimum"));
  const commonHits = Math.max(
    1,
    firstCount(record, ["number of hits", "number of grenades"]),
  );
  const pulseCount = Math.max(0, firstCount(record, ["pulses", "pulse"]));
  const actorType = actorTypeFor(record);
  return facts.map((fact, index) => {
    let hits = Math.max(1, Math.trunc(Number(fact.strikes || 0)));
    if (hits === 1 && facts.length === 1) {
      hits = Math.max(commonHits, pulseCount || 1);
    }
    const coefficient = Number(fact.coefficient) * hits;
    const label = fact.label || (
      facts.length > 1 ? `${record.page} — Packet ${index + 1}` : record.page
    );
    const rateOfFire = numeric(
      record.facts.find(candidate =>
        normalized(candidate.label).includes("rate of fire"))?.values?.[0],
      0,
    );
    if (normalized(record.type).includes("turret") && rateOfFire > 0) {
      hits = 5;
      return {
        type: "strike",
        coefficient: Number(fact.coefficient) * hits,
        hits,
        atMs: castTimeMs,
        intervalMs: Math.round(rateOfFire * 1000),
        timingAnchor: "castStart",
        timingScale: "fixed",
        name: label,
        actorType,
        persistsAfterInterrupt: true,
      };
    }
    if (hits > 1 && castTimeMs > 0) {
      return {
        type: "strike",
        coefficient,
        hits,
        atMs: Math.max(0, Math.round(castTimeMs / hits)),
        intervalMs: Math.max(1, Math.round(castTimeMs / hits)),
        timingAnchor: "castStart",
        timingScale: "cast",
        name: label,
        actorType,
      };
    }
    return {
      type: "strike",
      coefficient,
      hits,
      name: label,
      actorType,
    };
  });
}

function conditionEffects(record) {
  return record.facts
    .filter(fact => CONDITION_FACTS.has(normalized(fact.kind)))
    .map(fact => {
      const condition = canonicalTargetConditionName(fact.kind);
      const duration = numeric(fact.values?.[0], 0);
      if (!(duration > 0)) return null;
      return {
        type: "condition",
        condition,
        stacks: Math.max(1, Number(fact.stacks || 1)),
        duration,
        actorType: actorTypeFor(record),
      };
    })
    .filter(Boolean);
}

function controlEffects(record) {
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
    }
  }
  return effects;
}

function boonEffects(record) {
  return record.facts
    .filter(fact => BOON_FACTS.has(normalized(fact.kind)))
    .map(fact => {
      const duration = numeric(fact.values?.[0], 0);
      if (!(duration > 0)) return null;
      return {
        type: "boon",
        boon: fact.kind,
        duration,
        stacks: Math.max(1, Number(fact.stacks || 1)),
      };
    })
    .filter(Boolean);
}

function heatGain(record) {
  return record.facts
    .filter(fact => normalized(fact.kind) === "heat gain")
    .reduce((sum, fact) => sum + numeric(fact.values?.[0], 0), 0);
}

export function engineerMechanicsFromResearch(record) {
  const castTimeMs = Math.max(0, Math.round(numeric(record.activation) * 1000));
  return {
    implemented: true,
    castTimeMs,
    cooldown: Math.max(0, numeric(record.recharge)),
    ammo: Math.max(0, Math.trunc(numeric(record.ammo))),
    rechargeAnchor: "castEnd",
    timingConfidence: record.activation ? "wiki" : "estimated",
    sourceUrl: record.sourceUrl,
    sourceRevisionId: record.revisionId,
    sourceRevisionDate: String(record.revisionTimestamp || "").slice(0, 10),
    pveMode: true,
    heatGain: heatGain(record),
    actorType: actorTypeFor(record),
    effects: [
      ...damageEffects(record, castTimeMs),
      ...conditionEffects(record),
      ...controlEffects(record),
      ...boonEffects(record),
    ],
  };
}

export function engineerSupplementalSkill(record, id) {
  const stow = record.page.startsWith("Stow ");
  const kitEquip = normalized(record.type).includes("engineering kit");
  return {
    id: Number(id),
    name: record.page,
    description: record.description,
    icon: "",
    type: typeForResearch(record),
    slot: slotForResearch(record, id),
    specialization: record.specialization,
    categories: categoriesForResearch(record),
    flags: ["NoUnderwater"],
    recharge: Math.max(0, numeric(record.recharge)),
    ammo: Math.max(0, Math.trunc(numeric(record.ammo))),
    ammoRecharge: Math.max(0, numeric(record.recharge)),
    nextChainId: null,
    flipSkillId: null,
    kit: record.kit,
    kitEquip,
    kitName: kitEquip ? record.page : record.kit,
    kitStow: stow,
    toolbeltParentName:
      normalized(record.slot) === "mechanic" ? record.parent : "",
    mechanicSlot:
      record.mechanicSlot
      || (
        normalized(record.type).includes("morph")
          ? record.ids.indexOf(Number(id)) + 2
          : null
      ),
    forgeSkill: normalized(record.slot) === "transform"
      && record.specialization.toLowerCase() === "holosmith",
    simulatorExcluded: false,
  };
}
