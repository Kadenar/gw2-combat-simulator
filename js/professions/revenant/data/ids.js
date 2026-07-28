import {
  SKILLS,
  SPECIALIZATIONS,
} from "./revenant-api-metadata.js";
import {
  WIKI_SKILL_RESEARCH,
} from "./revenant-wiki-skill-research.js";

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

export const REVENANT_SKILL_IDS = Object.freeze({
  SWAP_WEAPONS: -3,
  SWAP_LEGENDS: -4,
  DODGE: -5,
  ...stableNameIndex([
    ...SKILLS.map(skill => [skill.name, skill.id]),
    ...WIKI_SKILL_RESEARCH.flatMap(skill =>
      skill.ids.map(id => [skill.page, id])),
  ]),
});
export const REVENANT_TRAIT_IDS = stableNameIndex(
  SPECIALIZATIONS.flatMap(specialization => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]).map(trait => [trait.name, trait.id]),
);
export const REVENANT_SPECIALIZATION_IDS = Object.freeze(
  Object.fromEntries(
    SPECIALIZATIONS.map(specialization => [
      constantName(specialization.name),
      specialization.id,
    ]),
  ),
);

export const REVENANT_LEGEND_IDS = Object.freeze({
  ASSASSIN: "LegendaryAssassin",
  DEMON: "LegendaryDemon",
  DWARF: "LegendaryDwarf",
  CENTAUR: "LegendaryCentaur",
  DRAGON: "LegendaryDragon",
  RENEGADE: "LegendaryRenegade",
  ALLIANCE: "LegendaryAlliance",
  ENTITY: "LegendaryEntity",
});

