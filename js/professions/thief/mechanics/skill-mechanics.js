import {
  THIEF_CORE_EXTRA_SKILLS,
  THIEF_CORE_SKILL_MECHANICS,
} from "../core/skills.js";
import {
  DAREDEVIL_SKILL_MECHANICS,
} from "../specializations/daredevil/skills.js";
import {
  DEADEYE_SKILL_MECHANICS,
} from "../specializations/deadeye/skills.js";
import {
  SPECTER_SKILL_MECHANICS,
} from "../specializations/specter/skills.js";
import {
  ANTIQUARY_SKILL_MECHANICS,
} from "../specializations/antiquary/skills.js";

function mergeMechanics(fragments) {
  const result = {};
  for (const fragment of fragments) {
    for (const [id, mechanics] of Object.entries(fragment)) {
      if (Object.hasOwn(result, id)) {
        throw new TypeError(`Duplicate Thief skill mechanics ID ${id}.`);
      }
      result[id] = mechanics;
    }
  }
  return Object.freeze(result);
}

export const THIEF_SKILL_MECHANICS = mergeMechanics([
  THIEF_CORE_SKILL_MECHANICS,
  DAREDEVIL_SKILL_MECHANICS,
  DEADEYE_SKILL_MECHANICS,
  SPECTER_SKILL_MECHANICS,
  ANTIQUARY_SKILL_MECHANICS,
]);

export const THIEF_EXTRA_SKILLS = THIEF_CORE_EXTRA_SKILLS;
