/**
 * Composes owner-local Core Elementalist skill catalogs without owning behavior.
 * Runtime execution and persistent state live in `execution/` and `mechanics/` modules.
 */
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import {
  ELEMENTALIST_CORE_ACTION_EXTRA_SKILLS,
  ELEMENTALIST_CORE_ACTION_SKILL_MECHANICS
} from '#gw2/content/professions/elementalist/core/skills/actions.js';
import { ELEMENTALIST_CONJURE_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/conjure-skills.js';
import { ELEMENTALIST_CORE_ELEMENTAL_EXTRA_SKILLS } from '#gw2/content/professions/elementalist/core/skills/elemental-skills.js';
import { ELEMENTALIST_CORE_TRAIT_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/trait-skills.js';
import { ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/dagger.js';
import { ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/focus.js';
import { ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/hammer.js';
import { ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/pistol.js';
import { ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/scepter.js';
import { ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/spear.js';
import { ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/staff.js';
import { ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/sword.js';
import { ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/weapons/warhorn.js';
import { ELEMENTALIST_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/profession-skills.js';
import { ELEMENTALIST_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/elementalist/core/skills/slot-skills.js';

/**
 * Composes physical-weapon fragments with Core attunements, utilities, conjures, and synthetic actions.
 *
 * Keyed by skill id and handed to the catalog by the Core module, so every API
 * skill entry picks up the simulator-authored mechanics for its family.
 */
export const ELEMENTALIST_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...ELEMENTALIST_CONJURE_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_ACTION_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_TRAIT_SKILL_MECHANICS,
  ...ELEMENTALIST_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...ELEMENTALIST_SLOT_SKILLS_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS
});

/** Preserves the catalog's existing supplemental-skill order while families own their entries. */
export const ELEMENTALIST_CORE_EXTRA_SKILLS = Object.freeze([
  ...ELEMENTALIST_CORE_ELEMENTAL_EXTRA_SKILLS,
  ...ELEMENTALIST_CORE_ACTION_EXTRA_SKILLS
]);
