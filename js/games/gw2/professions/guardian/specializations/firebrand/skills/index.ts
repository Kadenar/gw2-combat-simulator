import type { Skill } from '#gw2/platform/skills/types.js';
import { FIREBRAND_MANTRA_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/mantra-skills.js';
import { FIREBRAND_TOME_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';

/**
 * Composes Firebrand tome and mantra skill catalogs.
 * Persistent state and runtime behavior remain under `mechanics/`.
 */

/** Supplies the complete Firebrand catalog without owning family-specific fragments. */
export const FIREBRAND_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  ...FIREBRAND_TOME_SKILL_MECHANICS,
  ...FIREBRAND_MANTRA_SKILL_MECHANICS
});
