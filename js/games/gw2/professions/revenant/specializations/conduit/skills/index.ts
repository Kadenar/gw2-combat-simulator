/** Composes Conduit entity, Release Potential, and Cosmic Wisdom skill catalogs. */
import { CONDUIT_COSMIC_WISDOM_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/cosmic-wisdom-skills.js';
import { CONDUIT_ENTITY_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/entity-skills.js';
import { CONDUIT_RELEASE_POTENTIAL_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/release-potential-skills.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/** Preserves one public aggregate while named Conduit families own each fragment. */
export const CONDUIT_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...CONDUIT_ENTITY_SKILL_MECHANICS,
  ...CONDUIT_RELEASE_POTENTIAL_SKILL_MECHANICS,
  ...CONDUIT_COSMIC_WISDOM_SKILL_MECHANICS
});
