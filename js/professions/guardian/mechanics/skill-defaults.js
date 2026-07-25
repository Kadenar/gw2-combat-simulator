/**
 * Baseline executable mechanics derived from generated catalog metadata.
 *
 * Exact exceptions belong in skill-overrides.js.
 */

import { GUARDIAN_BUNDLE_SKILLS } from "../data/guardian-bundle-skills.js";
import { SKILLS } from "../data/guardian-catalog.js";
import {
  blind,
  condition,
  control,
  strike,
} from "../../../platform/engine/effect-factories.js";
import {
  implemented,
} from "../../../platform/engine/skill-factories.js";

const ALL_GUARDIAN_SKILLS = Object.freeze([
  ...SKILLS,
  ...GUARDIAN_BUNDLE_SKILLS,
]);

function inferredCastTimeMs(skill) {
  if (skill.type === "Profession") return 0;
  if (skill.type === "Weapon") {
    return skill.slot === "Weapon_1" ? 500 : 750;
  }
  if (skill.type === "Heal") return 1000;
  if (skill.type === "Elite") return 1000;
  return 250;
}

function inferredDamageFacts(skill) {
  const facts = [...(skill.apiDamage || [])];
  if (!facts.length) return [];
  const conditional = facts.filter(fact =>
    /^Damage With /i.test(String(fact.text || "")));
  if (conditional.length === facts.length) {
    return [conditional.reduce((best, fact) =>
      Number(fact.coefficient) > Number(best.coefficient) ? fact : best)];
  }
  const byText = new Map();
  for (const fact of facts) {
    if (/^Minimum Damage$/i.test(String(fact.text || ""))) continue;
    const key = String(fact.text || "Damage");
    const previous = byText.get(key);
    if (
      !previous
      || Number(fact.coefficient) > Number(previous.coefficient)
    ) {
      byText.set(key, fact);
    }
  }
  return [...byText.values()];
}

function inferredEffects(skill) {
  const effects = [];
  for (const fact of inferredDamageFacts(skill)) {
    const symbolPulse = (
      skill.categories?.includes("Symbol")
      && /symbol damage/i.test(String(fact.text || ""))
      && Number(fact.hits || 1) === 1
    );
    effects.push(strike(Number(fact.coefficient || 0), {
      hits: symbolPulse ? 5 : Math.max(1, Number(fact.hits || 1)),
      intervalMs: symbolPulse ? 1000 : undefined,
      name: fact.text && fact.text !== "Damage"
        ? `${skill.name} — ${fact.text}`
        : undefined,
    }));
  }
  for (const fact of skill.apiConditions || []) {
    if (!(Number(fact.duration) > 0) || !(Number(fact.stacks) > 0)) continue;
    effects.push(condition(
      fact.condition,
      Number(fact.stacks),
      Number(fact.duration),
    ));
  }
  const description = String(skill.description || "");
  if (/\b(?:daze|stun|knock|pull|launch|sink|float)\w*\b/i.test(description)) {
    effects.push(control());
  }
  if (/\bblind\w*\b/i.test(description)) effects.push(blind());
  return effects;
}

export const GUARDIAN_SKILL_DEFAULTS = Object.freeze(
  Object.fromEntries(ALL_GUARDIAN_SKILLS.map(skill => [skill.id, implemented({
    castTimeMs: inferredCastTimeMs(skill),
    ...(skill.categories?.includes("Virtue")
      ? { handlerId: "guardian.virtue" }
      : {}),
    ...(/^Renewed Focus$/.test(skill.name)
      ? { handlerId: "guardian.renewed-focus" }
      : {}),
    ...(skill.name === "Stow Tome"
      ? { handlerId: "guardian.stow-tome" }
      : {}),
    ...(skill.tome
      ? { handlerId: "guardian.tome-page" }
      : {}),
    ...(skill.radiantForgeSkill
      ? { handlerId: "guardian.radiant-weapon" }
      : {}),
    ...(/^(?:Enter|Exit) Radiant Forge$/.test(skill.name)
      ? { handlerId: "guardian.radiant-forge" }
      : {}),
    effects: inferredEffects(skill),
  })])),
);
