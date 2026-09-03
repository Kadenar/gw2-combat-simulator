/**
 * Composes the Reaper shroud and shout skill catalogs.
 * Family-specific skill fragments remain in their named catalog owners.
 */
import { REAPER_SHOUT_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shout-skills.js';
import { REAPER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/shroud-skills.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Supplies the composed Reaper skill catalog without owning family-specific fragments. */
export const REAPER_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...REAPER_SHROUD_SKILL_MECHANICS,
  ...REAPER_SHOUT_SKILL_MECHANICS
});
