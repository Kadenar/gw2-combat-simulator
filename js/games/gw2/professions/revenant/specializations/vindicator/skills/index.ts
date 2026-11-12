/** Composes Vindicator Alliance, dodge, and profession skill catalogs. */
import { composeSkillDefinitions, materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { VINDICATOR_DODGE_INPUT } from '#gw2/professions/revenant/data/vindicator-dodge.js';
import { VINDICATOR_DODGE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import { VINDICATOR_KURZICK_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/kurzick-skills.js';
import { VINDICATOR_LUXON_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/luxon-skills.js';
import { VINDICATOR_PROFESSION_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/profession-skills.js';

/** Preserves one public aggregate while named families own each definition. */
const VINDICATOR_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  VINDICATOR_LUXON_SKILL_MECHANICS,
  VINDICATOR_KURZICK_SKILL_MECHANICS,
  VINDICATOR_DODGE_SKILL_MECHANICS,
  VINDICATOR_PROFESSION_SKILL_MECHANICS
);

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const VINDICATOR_SKILLS = Object.freeze([
  ...materializeSkillDefinitions(VINDICATOR_BASE_SKILL_MECHANICS),
  VINDICATOR_DODGE_INPUT
]);
