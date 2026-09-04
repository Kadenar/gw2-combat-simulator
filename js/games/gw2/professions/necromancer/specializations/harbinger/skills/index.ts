/**
 * Composes the Harbinger elixir and shroud skill catalogs.
 * Family-specific skill fragments remain in their named catalog owners.
 */
import { HARBINGER_ELIXIR_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/elixir-skills.js';
import { HARBINGER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/shroud-skills.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Supplies the composed Harbinger skill catalog without owning family-specific fragments. */
export const HARBINGER_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...HARBINGER_ELIXIR_SKILL_MECHANICS,
  ...HARBINGER_SHROUD_SKILL_MECHANICS
});
