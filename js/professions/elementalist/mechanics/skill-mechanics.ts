/**
 * Application-facing composition facade for module-owned Elementalist skill
 * mechanics. Runtime modules import only their local skill declarations.
 */
import { ELEMENTALIST_CORE_SKILL_MECHANICS } from "../core/skills.js";
import { CATALYST_SKILL_MECHANICS } from "../specializations/catalyst/skills.js";
import { EVOKER_SKILL_MECHANICS } from "../specializations/evoker/skills.js";
import { TEMPEST_SKILL_MECHANICS } from "../specializations/tempest/skills.js";
import { WEAVER_SKILL_MECHANICS } from "../specializations/weaver/skills.js";
import type { SkillFragment } from "../../../platform/engine/types.js";

const fragments = Object.freeze([
  ELEMENTALIST_CORE_SKILL_MECHANICS,
  TEMPEST_SKILL_MECHANICS,
  WEAVER_SKILL_MECHANICS,
  CATALYST_SKILL_MECHANICS,
  EVOKER_SKILL_MECHANICS,
]);

const entries = fragments.flatMap((fragment) => Object.entries(fragment));
if (new Set(entries.map(([skillId]) => skillId)).size !== entries.length) {
  throw new TypeError("Duplicate Elementalist skill-mechanics ownership.");
}

export const ELEMENTALIST_SKILL_MECHANICS: Readonly<
  Record<string, SkillFragment>
> = Object.freeze(Object.fromEntries(entries));

export const ELEMENTALIST_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(ELEMENTALIST_SKILL_MECHANICS).map(Number),
);
