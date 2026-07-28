import { SKILLS } from "./engineer-api-metadata.js";
import {
  ENGINEER_WIKI_RESEARCH_BY_ID,
  engineerSupplementalSkill,
} from "../mechanics/wiki-mechanics.js";

const generatedIds = new Set(SKILLS.map(skill => skill.id));

export const ENGINEER_SUPPLEMENTAL_SKILLS = Object.freeze(
  [...ENGINEER_WIKI_RESEARCH_BY_ID]
    .filter(([id]) => !generatedIds.has(id))
    .map(([id, research]) =>
      Object.freeze(engineerSupplementalSkill(research, id)))
    .sort((left, right) => left.id - right.id),
);
