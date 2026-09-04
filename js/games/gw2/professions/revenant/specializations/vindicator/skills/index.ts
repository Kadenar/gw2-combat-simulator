/** Composes Vindicator Alliance, dodge, and profession skill catalogs. */
import { VINDICATOR_ALLIANCE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/alliance-skills.js';
import { VINDICATOR_DODGE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import { VINDICATOR_PROFESSION_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/profession-skills.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Preserves one public aggregate while named families own each fragment. */
export const VINDICATOR_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...VINDICATOR_ALLIANCE_SKILL_MECHANICS,
  ...VINDICATOR_DODGE_SKILL_MECHANICS,
  ...VINDICATOR_PROFESSION_SKILL_MECHANICS
});
