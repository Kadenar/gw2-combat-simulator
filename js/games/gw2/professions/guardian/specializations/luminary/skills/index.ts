import { composeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
/**
 * Composes Luminary Radiant Forge, stance, and virtue skill catalogs.
 * Persistent state and runtime behavior remain under `mechanics/`.
 */
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { LUMINARY_RADIANT_FORGE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { LUMINARY_STANCE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/stance-skills.js';
import { LUMINARY_VIRTUE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/virtue-skills.js';

/** Supplies the complete Luminary catalog without owning family-specific definitions. */
export const LUMINARY_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  LUMINARY_RADIANT_FORGE_SKILL_MECHANICS,
  LUMINARY_STANCE_SKILL_MECHANICS,
  LUMINARY_VIRTUE_SKILL_MECHANICS
);
