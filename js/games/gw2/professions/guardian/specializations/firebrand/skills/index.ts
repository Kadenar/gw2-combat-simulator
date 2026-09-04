/**
 * Composes Firebrand tome and mantra skill catalogs.
 * Persistent state and runtime behavior remain under `mechanics/`.
 */
import { FIREBRAND_MANTRA_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/mantra-skills.js';
import { FIREBRAND_TOME_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Supplies the complete Firebrand catalog without owning family-specific fragments. */
export const FIREBRAND_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...FIREBRAND_TOME_SKILL_MECHANICS,
  ...FIREBRAND_MANTRA_SKILL_MECHANICS
});
