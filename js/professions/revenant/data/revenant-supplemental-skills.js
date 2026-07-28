import { SKILLS } from "./revenant-api-metadata.js";
import {
  REVENANT_WIKI_RESEARCH_BY_ID,
  revenantSupplementalSkill,
} from "../mechanics/wiki-mechanics.js";

const generatedIds = new Set(SKILLS.map(skill => skill.id));
export const REVENANT_SUPPLEMENTAL_SKILLS = Object.freeze(
  [...REVENANT_WIKI_RESEARCH_BY_ID]
    .filter(([id]) => !generatedIds.has(id))
    .map(([id, research]) =>
      Object.freeze(revenantSupplementalSkill(research, id)))
    .sort((left, right) => left.id - right.id),
);

