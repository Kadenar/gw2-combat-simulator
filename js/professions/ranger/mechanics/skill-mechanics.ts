/** Application-facing composition facade for module-owned Ranger mechanics. */
import { RANGER_CORE_BASE_SKILL_MECHANICS } from "../core/skills.js";
import { DRUID_BASE_SKILL_MECHANICS } from "../specializations/druid/skills.js";
import { SOULBEAST_BASE_SKILL_MECHANICS } from "../specializations/soulbeast/skills.js";
import { UNTAMED_BASE_SKILL_MECHANICS } from "../specializations/untamed/skills.js";
import { GALESHOT_BASE_SKILL_MECHANICS } from "../specializations/galeshot/skills.js";
import type { SkillFragment } from "../../../platform/engine/types.js";

export const RANGER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> =
  Object.freeze({
    ...RANGER_CORE_BASE_SKILL_MECHANICS,
    ...DRUID_BASE_SKILL_MECHANICS,
    ...SOULBEAST_BASE_SKILL_MECHANICS,
    ...UNTAMED_BASE_SKILL_MECHANICS,
    ...GALESHOT_BASE_SKILL_MECHANICS,
  });

export const RANGER_IMPLEMENTED_SKILL_IDS = Object.freeze(
  Object.keys(RANGER_SKILL_MECHANICS).map(Number),
);
