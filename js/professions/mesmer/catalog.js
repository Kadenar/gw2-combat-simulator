import { SPECIALIZATIONS } from "./data/mesmer-catalog.js";
import { TRAITS } from "./data/traits-data.js";
import {
  AMBUSH_SKILLS,
  PSEUDO_SKILLS,
} from "./mechanics/mesmer-skill-overrides.js";
import { SIMULATOR_SKILLS } from "./mechanics/mesmer-skill-normalization.js";
import { validateCanonicalCatalog } from "../../platform/engine/catalog.js";

const skills = [];
const seen = new Set();
for (const skill of [...SIMULATOR_SKILLS, ...AMBUSH_SKILLS, ...PSEUDO_SKILLS]) {
  if (seen.has(skill.id)) {
    throw new Error(`Duplicate Mesmer skill id: ${skill.id}`);
  }
  seen.add(skill.id);
  skills.push(Object.freeze({
    ...skill,
    tags: Object.freeze([...(skill.tags || [])]),
    effects: Object.freeze([...(skill.effects || [])]),
  }));
}

export const mesmerCatalog = Object.freeze({
  skills: Object.freeze(skills),
  traits: Object.freeze([...TRAITS]),
  specializations: Object.freeze([...SPECIALIZATIONS]),
  skillsById: new Map(skills.map(skill => [skill.id, skill])),
  skillsByName: new Map(skills.map(skill => [skill.name, skill])),
  handlerIds: new Set(
    skills.map(skill => skill.handlerId).filter(Boolean),
  ),
  weapons: new Set(
    skills.map(skill => skill.weapon).filter(Boolean),
  ),
});

validateCanonicalCatalog(mesmerCatalog);

export const MESMER_SKILLS = mesmerCatalog.skills;
