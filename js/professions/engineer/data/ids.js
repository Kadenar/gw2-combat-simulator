import {
  SKILLS,
  SPECIALIZATIONS,
} from "./engineer-api-metadata.js";
import {
  ENGINEER_SUPPLEMENTAL_SKILLS,
} from "./engineer-supplemental-skills.js";

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

export const ENGINEER_SKILL_IDS = Object.freeze({
  SWAP_WEAPONS: -3,
  DODGE: -5,
  STOW_ELITE_MORTAR_KIT: -301,
  ...stableNameIndex([
    ...SKILLS.map(skill => [skill.name, skill.id]),
    ...ENGINEER_SUPPLEMENTAL_SKILLS.map(skill => [skill.name, skill.id]),
  ]),
});

export const ENGINEER_TRAIT_IDS = stableNameIndex(
  SPECIALIZATIONS.flatMap(specialization => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]).map(trait => [trait.name, trait.id]),
);

export const ENGINEER_SPECIALIZATION_IDS = Object.freeze(
  Object.fromEntries(
    SPECIALIZATIONS.map(specialization => [
      constantName(specialization.name),
      specialization.id,
    ]),
  ),
);

export const ENGINEER_INTERNAL_IDS = Object.freeze({
  MECH_BASIC_ATTACK: "engineer.mech-basic-attack",
  KIT_TRANSITION: "engineer.kit-transition",
  PHOTON_FORGE_TRANSITION: "engineer.photon-forge-transition",
});
