/**
 * Composes Weaver dual-weapon and slot-skill catalogs without owning runtime behavior.
 * Dual-attunement and weapon state live under `mechanics/`.
 */
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { WEAVER_SLOT_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/slot-skills.js';
import { WEAVER_DAGGER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/dagger.js';
import { WEAVER_HAMMER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/hammer.js';
import { WEAVER_PISTOL_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/pistol.js';
import { WEAVER_SCEPTER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/scepter.js';
import { WEAVER_SPEAR_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/spear.js';
import { WEAVER_STAFF_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/staff.js';
import { WEAVER_SWORD_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/weapons/sword.js';

/** Preserves the original weapon-first spread order before adding non-weapon skills. */
export const WEAVER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...WEAVER_DAGGER_SKILL_MECHANICS,
  ...WEAVER_HAMMER_SKILL_MECHANICS,
  ...WEAVER_PISTOL_SKILL_MECHANICS,
  ...WEAVER_SCEPTER_SKILL_MECHANICS,
  ...WEAVER_SPEAR_SKILL_MECHANICS,
  ...WEAVER_STAFF_SKILL_MECHANICS,
  ...WEAVER_SWORD_SKILL_MECHANICS,
  ...WEAVER_SLOT_SKILL_MECHANICS
});
