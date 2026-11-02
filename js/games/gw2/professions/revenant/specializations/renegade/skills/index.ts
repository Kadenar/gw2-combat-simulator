/** Composes Renegade warband and order skill catalogs. */
import { composeSkillDefinitions, materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RENEGADE_ORDER_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/order-skills.js';
import {
  RENEGADE_EXTRA_SKILLS,
  RENEGADE_WARBAND_SKILL_MECHANICS
} from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';

/** Preserves one public aggregate while named Renegade families own each definition. */
const RENEGADE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  RENEGADE_WARBAND_SKILL_MECHANICS,
  RENEGADE_ORDER_SKILL_MECHANICS
);

/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const RENEGADE_SKILLS = Object.freeze([
  ...materializeSkillDefinitions(RENEGADE_BASE_SKILL_MECHANICS),
  ...RENEGADE_EXTRA_SKILLS
]);
