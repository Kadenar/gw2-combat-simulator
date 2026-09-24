/**
 * Composes Luminary Radiant Forge, stance, and virtue skill catalogs.
 * Persistent state and runtime behavior remain under `mechanics/`.
 */
import { LUMINARY_RADIANT_FORGE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { LUMINARY_STANCE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/stance-skills.js';
import { LUMINARY_VIRTUE_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/virtue-skills.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Supplies the complete Luminary catalog without owning family-specific fragments. */
export const LUMINARY_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  ...LUMINARY_RADIANT_FORGE_SKILL_MECHANICS,
  ...LUMINARY_STANCE_SKILL_MECHANICS,
  ...LUMINARY_VIRTUE_SKILL_MECHANICS
});

export {
  LUMINARY_EXTRA_SKILLS,
  LUMINARY_INITIAL_STATE_SKILL_IDS
} from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
