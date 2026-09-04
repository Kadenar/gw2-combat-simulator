/**
 * Composes owner-local Core Revenant skill catalogs without owning runtime behavior.
 * Balance profiles and execution live in sibling owner modules.
 */
import { REVENANT_CORE_EXTRA_SKILLS } from '#gw2/professions/revenant/core/skills/actions.js';
import { REVENANT_LEGEND_CALL_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legend-call-skills.js';
import { REVENANT_ASSASSIN_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legends/assassin.js';
import { REVENANT_CENTAUR_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legends/centaur.js';
import { REVENANT_DEMON_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legends/demon.js';
import { REVENANT_DWARF_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/legends/dwarf.js';
import { REVENANT_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/profession-skills.js';
import { REVENANT_SUPPLEMENTAL_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/supplemental-skills.js';
import { REVENANT_TRAIT_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/trait-skills.js';
import { REVENANT_UNDERWATER_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/underwater-skills.js';
import { REVENANT_WEAPONS_AXE_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/axe.js';
import { REVENANT_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/greatsword.js';
import { REVENANT_WEAPONS_HAMMER_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/hammer.js';
import { REVENANT_WEAPONS_MACE_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/mace.js';
import { REVENANT_WEAPONS_SCEPTER_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/scepter.js';
import { REVENANT_WEAPONS_SHIELD_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/shield.js';
import { REVENANT_WEAPONS_SHORTBOW_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/shortbow.js';
import { REVENANT_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/spear.js';
import { REVENANT_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/staff.js';
import { REVENANT_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/professions/revenant/core/skills/weapons/sword.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Preserves the original catalog precedence while each skill family owns its fragments. */
export const REVENANT_CORE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...REVENANT_UNDERWATER_SKILL_MECHANICS,
  ...REVENANT_TRAIT_SKILL_MECHANICS,
  ...REVENANT_LEGEND_CALL_SKILL_MECHANICS,
  ...REVENANT_SUPPLEMENTAL_SKILL_MECHANICS,
  ...REVENANT_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...REVENANT_DWARF_SKILL_MECHANICS,
  ...REVENANT_CENTAUR_SKILL_MECHANICS,
  ...REVENANT_ASSASSIN_SKILL_MECHANICS,
  ...REVENANT_DEMON_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_AXE_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_GREATSWORD_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_HAMMER_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_MACE_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_SCEPTER_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_SHIELD_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_SHORTBOW_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_SPEAR_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_STAFF_SKILL_MECHANICS,
  ...REVENANT_WEAPONS_SWORD_SKILL_MECHANICS
});

export { REVENANT_CORE_EXTRA_SKILLS };
