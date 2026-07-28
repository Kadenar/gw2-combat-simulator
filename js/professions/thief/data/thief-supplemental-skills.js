import { SKILLS } from "./thief-api-metadata.js";
import {
  THIEF_WIKI_RESEARCH_BY_ID,
  thiefSupplementalSkill,
} from "../mechanics/wiki-mechanics.js";
const generatedIds = new Set(SKILLS.map(skill => skill.id));
export const THIEF_SUPPLEMENTAL_SKILLS = Object.freeze(
  [...THIEF_WIKI_RESEARCH_BY_ID]
    .filter(([id]) => !generatedIds.has(id))
    .map(([id, research]) => Object.freeze(thiefSupplementalSkill(research, id)))
    .sort((left, right) => left.id - right.id),
);

