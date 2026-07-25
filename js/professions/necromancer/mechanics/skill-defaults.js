/**
 * Baseline executable mechanics derived from generated catalog metadata.
 *
 * Exact exceptions belong in skill-overrides.js.
 */

import { NECROMANCER_SKILL_IDS as ID } from "../data/ids.js";
import { SKILLS } from "../data/necromancer-catalog.js";
import {
  NECROMANCER_SUPPLEMENTAL_SKILLS,
} from "../data/necromancer-supplemental-skills.js";
import {
  blind,
  buff,
  condition,
  control,
  custom,
  strike,
} from "../../../platform/engine/effect-factories.js";
import {
  implemented as implementedSkill,
} from "../../../platform/engine/skill-factories.js";

const ALL_API_SKILLS = Object.freeze([
  ...SKILLS,
  ...NECROMANCER_SUPPLEMENTAL_SKILLS,
]);

const implemented = definition => implementedSkill({
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
        ? `${skill.name} â€” ${fact.text}`
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
  if (statuses.has("Blinded")) effects.push(blind());
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
    effects.push(buff(
      "target-vulnerability",
      Number(vulnerability.duration),
      {
        stacks: Math.max(1, Number(vulnerability.apply_count || 1)),
      },
    ));
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

export const NECROMANCER_SKILL_DEFAULTS = Object.freeze(Object.fromEntries(
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
