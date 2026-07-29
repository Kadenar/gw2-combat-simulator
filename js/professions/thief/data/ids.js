import { SKILLS, SPECIALIZATIONS } from "./thief-api-metadata.js";
import {
  THIEF_SUPPLEMENTAL_SKILLS,
} from "./thief-supplemental-skills.js";

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
    ...THIEF_SUPPLEMENTAL_SKILLS.map(skill => [skill.name, skill.id]),
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

// Keep canonical PvE artifact identities explicit so deterministic artifact
// draws never depend on API alias ordering.
export const THIEF_ARTIFACT_IDS = Object.freeze({
  // Display order follows the Guild Wars 2 Wiki artifact tables.
  OFFENSIVE: Object.freeze([
    76633, // Forged Surfer Dash
    76582, // Metal Legion Guitar
    77277, // Mistburn Mortar
    77192, // Summon Kryptis Turret
  ]),
  DEFENSIVE: Object.freeze([
    76816, // Chak Shield
    76702, // Exalted Hammer
    76674, // Holo-Dancer Decoy
    76895, // Zephyrite Sun Crystal
  ]),
});
