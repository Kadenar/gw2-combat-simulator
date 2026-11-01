import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
/**
 * Composes the Reaper shroud and shout skill catalogs.
 * Family-specific skill definitions remain in their named catalog owners.
 */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REAPER_SHOUT_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shout-skills.js';
import { REAPER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shroud-skills.js';

/** Supplies the composed Reaper skill catalog without owning family-specific definitions. */
export const REAPER_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  REAPER_SHROUD_SKILL_MECHANICS,
  REAPER_SHOUT_SKILL_MECHANICS
);
