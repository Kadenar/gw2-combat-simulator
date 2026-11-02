/**
 * Composes owner-local Core Elementalist skill catalogs without owning behavior.
 * Runtime execution and persistent state live in `execution/` and `mechanics/` modules.
 */
import { composeSkillDefinitions, materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_CORE_ACTION_EXTRA_SKILLS } from '#gw2/professions/elementalist/core/skills/actions.js';
import { ELEMENTALIST_CONJURE_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/conjure-skills.js';
import { ELEMENTALIST_CORE_ELEMENTAL_EXTRA_SKILLS } from '#gw2/professions/elementalist/core/skills/elemental-skills.js';
import { ELEMENTALIST_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/profession-skills.js';
import { ELEMENTALIST_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/slot-skills.js';
import { ELEMENTALIST_CORE_TRAIT_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/trait-skills.js';
import { ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/dagger.js';
import { ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/focus.js';
import { ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/hammer.js';
import { ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/pistol.js';
import { ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/scepter.js';
import { ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/spear.js';
import { ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/staff.js';
import { ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/sword.js';
import { ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS } from '#gw2/professions/elementalist/core/skills/weapons/warhorn.js';

/**
 * Composes physical-weapon definitions with Core attunements, utilities, conjures, and synthetic actions.
 *
 * Each keyed entry contributes its complete definition through the Core module.
 */
const ELEMENTALIST_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = composeSkillDefinitions(
  ELEMENTALIST_CONJURE_SKILL_MECHANICS,
  ELEMENTALIST_CORE_TRAIT_SKILL_MECHANICS,
  ELEMENTALIST_PROFESSION_SKILLS_SKILL_MECHANICS,
  ELEMENTALIST_SLOT_SKILLS_SKILL_MECHANICS,
  ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS,
  ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS,
  ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS,
  ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS,
  ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS,
  ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS,
  ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS,
  ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS,
  ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS
);

/** Preserves the catalog's existing declaration order while families own their entries. */
/** One complete module collection includes authored skills, generated attacks, and simulator actions. */
export const ELEMENTALIST_CORE_SKILLS = Object.freeze([
  ...materializeSkillDefinitions(ELEMENTALIST_CORE_SKILL_MECHANICS),
  ...ELEMENTALIST_CORE_ELEMENTAL_EXTRA_SKILLS,
  ...ELEMENTALIST_CORE_ACTION_EXTRA_SKILLS
]);
