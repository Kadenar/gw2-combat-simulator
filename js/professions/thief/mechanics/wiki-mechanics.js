import {
  canonicalTargetConditionName,
} from "../../../platform/gw2/target-state.js";
import {
  WIKI_SKILL_RESEARCH,
} from "../data/thief-wiki-skill-research.js";

const EXCLUDED_SLOTS = new Set(["downed", "drowning"]);
const CONDITION_FACTS = new Set([
  "bleeding", "burning", "chilled", "confusion", "cripple", "crippled",
  "immobile", "immobilized", "poison", "poisoned", "slow", "torment",
  "vulnerability", "weakness",
]);
const CONTROL_FACTS = new Set([
  "daze", "float", "knockback", "knockdown", "launch", "pull", "stun",
]);
const BOON_FACTS = new Set([
  "aegis", "alacrity", "fury", "might", "protection", "quickness",
  "regeneration", "resolution", "resistance", "stability", "superspeed",
  "swiftness", "vigor",
]);
const DUAL_WIELD = Object.freeze({
  "Death Blossom": ["Dagger", "Dagger"],
  "Shadow Shot": ["Dagger", "Pistol"],
  "Twisting Fangs": ["Dagger", false],
  "Shadow Strike": ["Pistol", "Dagger"],
  Unload: ["Pistol", "Pistol"],
  Repeater: ["Pistol", false],
  "Repeater (offhand empty)": ["Pistol", false],
  "Flanking Strike": ["Sword", "Dagger"],
  "Flawless Execution": ["Sword", "Pistol"],
  Stab: ["Sword", false],
  "Stab (thief sword skill)": ["Sword", false],
  "Measured Shot": ["Scepter", "Pistol"],
  "Endless Night": ["Scepter", "Pistol"],
  "Twilight Combo": ["Scepter", "Dagger"],
  "Triple Threat": ["Scepter", false],
  "Harrowing Storm": ["Axe", "Dagger"],
  "Orchestrated Assault": ["Axe", "Pistol"],
  "Recall Axes": ["Axe", false],
});
const DUAL_WIELD_BY_ID = Object.freeze({
  13007: ["Sword", "Dagger"],
  59526: ["Pistol", "Dagger"],
});
const STEALTH_WEAPON = Object.freeze({
  Backstab: "Dagger",
  "Malicious Backstab": "Dagger",
  "Sneak Attack": "Pistol",
  "Malicious Sneak Attack": "Pistol",
  "Tactical Strike": "Sword",
  "Malicious Tactical Strike": "Sword",
  "Hook Strike": "Staff",
  "Malicious Hook Strike": "Staff",
  "Death's Judgment": "Rifle",
  "Malicious Death's Judgment": "Rifle",
  Shadowsquall: "Scepter",
  "Malicious Shadowsquall": "Scepter",
  "Cunning Salvo": "Axe",
  "Malicious Cunning Salvo": "Axe",
  "Surprise Shot": "Shortbow",
  "Malicious Surprise Shot": "Shortbow",
  "Ashen Assault": "Spear",
  "Malicious Ashen Assault": "Spear",
  "Deadly Strike": "Spear",
  "Malicious Deadly Strike": "Spear",
  "The Ripper": "Spear",
  "Malicious Ripper": "Spear",
});

function numeric(value, fallback = 0) {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}
function normalized(value) {
  return String(value || "").trim().toLowerCase();
}
function title(value) {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}
function isTerrestrial(record) {
  return (
    !record.page.toLowerCase().includes("(underwater)")
    && !EXCLUDED_SLOTS.has(normalized(record.slot))
  );
}
export const THIEF_WIKI_RESEARCH_BY_ID = new Map(
  WIKI_SKILL_RESEARCH.flatMap(record =>
    record.ids.filter(() => isTerrestrial(record)).map(id => [id, record])),
);
function slotFor(record) {
  const slot = normalized(record.slot);
  if (slot === "weapon" || slot === "transform") {
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
  if (slot === "weapon" || slot === "transform") return "Weapon";
  if (slot === "healing") return "Heal";
  if (slot === "utility") return "Utility";
  if (slot === "elite") return "Elite";
  if (slot === "mechanic") return "Profession";
  return "Action";
}
function conditionName(value) {
  return normalized(value) === "immobile"
    ? "Immobilized"
    : canonicalTargetConditionName(value);
}
function firstCount(record, names) {
  const fact = record.facts.find(candidate => {
    const kind = normalized(candidate.kind);
    const label = normalized(candidate.label);
    return names.some(name => kind.includes(name) || label.includes(name));
  });
  return Math.max(0, Math.trunc(numeric(fact?.values?.[0], 0)));
}
function actorTypeFor(record) {
  return normalized(record.type).includes("summon") ? "summon" : "player";
}
function effects(record, castTimeMs) {
  const result = [];
  const damage = record.facts.filter(fact =>
    ["damage", "life siphon damage"].includes(normalized(fact.kind))
    && Number.isFinite(Number(fact.coefficient))
    && !normalized(fact.label).includes("minimum"));
  const hasFrontPacket = damage.some(fact =>
    normalized(fact.label).includes("front"));
  const selectedDamage = hasFrontPacket
    ? damage.filter(fact => !normalized(fact.label).includes("back"))
    : damage;
  const commonHits = Math.max(1, firstCount(record, [
    "number of hits", "number of impacts", "pulses", "pulse",
  ]));
  for (const [index, fact] of selectedDamage.entries()) {
    let hits = Math.max(1, Math.trunc(Number(fact.strikes || 0)));
    if (hits === 1 && selectedDamage.length === 1) hits = commonHits;
    const effect = {
      type: "strike",
      coefficient: Number(fact.coefficient) * hits,
      hits,
      name: fact.label || (
        selectedDamage.length > 1
          ? `${record.page} — Packet ${index + 1}`
          : record.page
      ),
      actorType: actorTypeFor(record),
    };
    if (hits > 1 && castTimeMs > 0) {
      effect.atMs = Math.round(castTimeMs / hits);
      effect.intervalMs = Math.max(1, Math.round(castTimeMs / hits));
      effect.timingAnchor = "castStart";
      effect.timingScale = "cast";
    }
    result.push(effect);
  }
  for (const fact of record.facts) {
    const kind = normalized(fact.kind);
    if (CONDITION_FACTS.has(kind)) {
      const duration = numeric(fact.values?.[0], 0);
      if (duration > 0) result.push({
        type: "condition",
        condition: conditionName(fact.kind),
        stacks: Math.max(1, Number(fact.stacks || 1)),
        duration,
        actorType: actorTypeFor(record),
      });
    } else if (kind === "stealth") {
      const duration = numeric(fact.values?.[0], 0);
      if (duration > 0) result.push({
        type: "buff",
        kind: "stealth",
        duration,
        stacks: 1,
      });
    } else if (kind === "blind" || kind === "blinded") {
      result.push({ type: "blind", actorType: actorTypeFor(record) });
    } else if (CONTROL_FACTS.has(kind)) {
      result.push({
        type: "control",
        actorType: actorTypeFor(record),
        metadata: {
          controlKind: kind,
          duration: Math.max(0, numeric(fact.values?.[0], 0)),
        },
      });
    } else if (BOON_FACTS.has(kind)) {
      const duration = numeric(fact.values?.[0], 0);
      if (duration > 0) result.push({
        type: "boon",
        boon: fact.kind,
        duration,
        stacks: Math.max(1, Number(fact.stacks || 1)),
      });
    }
  }
  return result;
}

export function thiefMechanicsFromResearch(record) {
  const castTimeMs = Math.max(0, Math.round(numeric(record.activation) * 1000));
  return {
    implemented: true,
    castTimeMs,
    cooldown: Math.max(0, numeric(record.recharge)),
    ammo: Math.max(0, Math.trunc(numeric(record.ammo))),
    initiativeCost: Math.max(0, numeric(record.initiative)),
    rechargeAnchor: "castEnd",
    timingConfidence: record.activation ? "wiki" : "estimated",
    sourceUrl: record.sourceUrl,
    sourceRevisionId: record.revisionId,
    sourceRevisionDate: String(record.revisionTimestamp || "").slice(0, 10),
    pveMode: true,
    actorType: actorTypeFor(record),
    effects: effects(record, castTimeMs),
  };
}

export function thiefSupplementalSkill(record, id) {
  const dual = DUAL_WIELD_BY_ID[id] || DUAL_WIELD[record.page];
  const stealthWeapon = STEALTH_WEAPON[record.page];
  const recordType = normalized(record.type);
  const artifactKind = recordType.includes("offensive artifact")
    ? "offensive"
    : recordType.includes("defensive artifact")
      ? "defensive"
      : null;
  return {
    id: Number(id),
    name: record.page,
    description: record.description,
    icon: "",
    type: typeFor(record),
    slot: artifactKind ? "Profession_2" : slotFor(record),
    weapon: title(record.weapon || record.mainhand || stealthWeapon),
    specialization: title(record.specialization),
    categories: String(record.type || "").split(",").map(value => value.trim())
      .filter(Boolean),
    flags: ["NoUnderwater"],
    recharge: Math.max(0, numeric(record.recharge)),
    ammo: Math.max(0, Math.trunc(numeric(record.ammo))),
    ammoRecharge: Math.max(0, numeric(record.recharge)),
    nextChainId: null,
    flipSkillId: null,
    initiativeCost: Math.max(0, numeric(record.initiative)),
    requiredMainHand: dual?.[0] || stealthWeapon || null,
    requiredOffHand: dual?.[1] ?? null,
    stealthAttack: recordType.includes("stealth attack"),
    malicious: record.page.startsWith("Malicious "),
    kneelSkill: recordType.includes("kneel"),
    shadowShroudSkill:
      normalized(record.slot) === "transform"
      && normalized(record.specialization) === "specter",
    artifactKind,
    doubleEdge: recordType.includes("double edge"),
    backfire:
      recordType.includes("backfire")
      || normalized(record.page).includes("backfired"),
    simulatorExcluded: false,
  };
}
