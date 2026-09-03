/**
 * Composes Evoker familiar and meditation skill catalogs without owning runtime behavior.
 * Persistent familiar state remains under `mechanics/`.
 */
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { EVOKER_FAMILIAR_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import { EVOKER_MEDITATION_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/meditation-skills.js';

/** Preserves the original family order for the Evoker module catalog. */
export const EVOKER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...EVOKER_FAMILIAR_SKILL_MECHANICS,
  ...EVOKER_MEDITATION_SKILL_MECHANICS
});
