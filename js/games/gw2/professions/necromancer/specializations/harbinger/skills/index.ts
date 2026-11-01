import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
/**
 * Composes the Harbinger elixir and shroud skill catalogs.
 * Family-specific skill definitions remain in their named catalog owners.
 */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { HARBINGER_ELIXIR_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/elixir-skills.js';
import { HARBINGER_SHROUD_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/shroud-skills.js';

/** Supplies the composed Harbinger skill catalog without owning family-specific definitions. */
export const HARBINGER_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  HARBINGER_ELIXIR_SKILL_MECHANICS,
  HARBINGER_SHROUD_SKILL_MECHANICS
);
