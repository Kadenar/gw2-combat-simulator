import { SKILLS, SPECIALIZATIONS } from "./thief-api-metadata.js";
import { WIKI_SKILL_RESEARCH } from "./thief-wiki-skill-research.js";

function constantName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}
function stableNameIndex(entries) {
  const result = {};
  for (const [name, id] of entries) {
    const base = constantName(name);
    if (!base) continue;
    const key = Object.hasOwn(result, base) ? `${base}_ID_${id}` : base;
    result[key] = Number(id);
  }
  return Object.freeze(result);
}
export const THIEF_SKILL_IDS = Object.freeze({
  SWAP_WEAPONS: -3,
  DODGE: -5,
  ...stableNameIndex([
    ...SKILLS.map(skill => [skill.name, skill.id]),
    ...WIKI_SKILL_RESEARCH.flatMap(skill =>
      skill.ids.map(id => [skill.page, id])),
  ]),
});
export const THIEF_TRAIT_IDS = stableNameIndex(
  SPECIALIZATIONS.flatMap(specialization => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]).map(trait => [trait.name, trait.id]),
);
export const THIEF_SPECIALIZATION_IDS = Object.freeze(
  Object.fromEntries(
    SPECIALIZATIONS.map(specialization => [
      constantName(specialization.name),
      specialization.id,
    ]),
  ),
);

// The live API exposes several same-name terrestrial/underwater artifact
// variants. Keep the terrestrial identities explicit so deterministic
// artifact draws never depend on name-collision order.
export const THIEF_ARTIFACT_IDS = Object.freeze({
  OFFENSIVE: Object.freeze([
    76633, // Forged Surfer Dash
    76582, // Metal Legion Guitar
    77192, // Summon Kryptis Turret
    77277, // Mistburn Mortar
  ]),
  DEFENSIVE: Object.freeze([
    76674, // Holo-Dancer Decoy
    76702, // Exalted Hammer
    76816, // Chak Shield
    76895, // Zephyrite Sun Crystal
  ]),
});
