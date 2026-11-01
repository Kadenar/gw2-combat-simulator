import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
/** Composes Vindicator Alliance, dodge, and profession skill catalogs. */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { VINDICATOR_ALLIANCE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/alliance-skills.js';
import { VINDICATOR_DODGE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import { VINDICATOR_PROFESSION_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/profession-skills.js';

/** Preserves one public aggregate while named families own each definition. */
export const VINDICATOR_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  VINDICATOR_ALLIANCE_SKILL_MECHANICS,
  VINDICATOR_DODGE_SKILL_MECHANICS,
  VINDICATOR_PROFESSION_SKILL_MECHANICS
);
