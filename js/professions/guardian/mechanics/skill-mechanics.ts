/**
 * Application-facing composition facade for module-owned Guardian skill
 * mechanics. Runtime modules import only their local skill declarations.
 */
import {
  GUARDIAN_CORE_EXTRA_SKILLS,
  GUARDIAN_CORE_SKILL_MECHANICS,
} from "../core/skills.js";
import { DRAGONHUNTER_SKILL_MECHANICS } from "../specializations/dragonhunter/skills.js";
import { FIREBRAND_SKILL_MECHANICS } from "../specializations/firebrand/skills.js";
import { WILLBENDER_SKILL_MECHANICS } from "../specializations/willbender/skills.js";
import { LUMINARY_SKILL_MECHANICS } from "../specializations/luminary/skills.js";
import type { Skill, SkillFragment } from "../../../platform/engine/types.js";

const fragments = Object.freeze([
  GUARDIAN_CORE_SKILL_MECHANICS,
  DRAGONHUNTER_SKILL_MECHANICS,
  FIREBRAND_SKILL_MECHANICS,
  WILLBENDER_SKILL_MECHANICS,
  LUMINARY_SKILL_MECHANICS,
]);

const entries = fragments.flatMap((fragment) => Object.entries(fragment));
if (new Set(entries.map(([skillId]) => skillId)).size !== entries.length) {
  throw new TypeError("Duplicate Guardian skill-mechanics ownership.");
}

export const GUARDIAN_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> =
  Object.freeze(Object.fromEntries(entries));

export const GUARDIAN_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(GUARDIAN_SKILL_MECHANICS).map(Number),
);

export const GUARDIAN_EXTRA_SKILLS: readonly Skill[] =
  GUARDIAN_CORE_EXTRA_SKILLS;
