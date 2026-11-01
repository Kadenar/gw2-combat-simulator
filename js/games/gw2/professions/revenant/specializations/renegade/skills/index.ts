import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
/** Composes Renegade warband and order skill catalogs. */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RENEGADE_ORDER_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/order-skills.js';
import { RENEGADE_WARBAND_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';

/** Preserves one public aggregate while named Renegade families own each definition. */
export const RENEGADE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  RENEGADE_WARBAND_SKILL_MECHANICS,
  RENEGADE_ORDER_SKILL_MECHANICS
);
