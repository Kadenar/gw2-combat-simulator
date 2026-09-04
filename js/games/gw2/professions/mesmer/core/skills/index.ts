/**
 * Composes owner-local Core Mesmer skill catalogs without owning behavior.
 * Runtime execution lives in sibling controller files and persistent illusion state lives under `mechanics/`.
 */
import type { SkillFragment, SkillId } from '#gw2/platform/engine/skills/types.js';

import { MESMER_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { MESMER_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/slot-skills.js';
import { MESMER_WEAPONS_AXE_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/axe.js';
import { MESMER_WEAPONS_DAGGER_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/dagger.js';
import { MESMER_WEAPONS_FOCUS_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/focus.js';
import { MESMER_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/greatsword.js';
import { MESMER_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/pistol.js';
import { MESMER_WEAPONS_RIFLE_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/rifle.js';
import { MESMER_WEAPONS_SCEPTER_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/scepter.js';
import { MESMER_WEAPONS_SHIELD_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/shield.js';
import { MESMER_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/spear.js';
import { MESMER_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/staff.js';
import { MESMER_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/sword.js';
import { MESMER_WEAPONS_TORCH_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/weapons/torch.js';

export const MESMER_CORE_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  ...MESMER_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...MESMER_SLOT_SKILLS_SKILL_MECHANICS,
  ...MESMER_WEAPONS_AXE_SKILL_MECHANICS,
  ...MESMER_WEAPONS_DAGGER_SKILL_MECHANICS,
  ...MESMER_WEAPONS_FOCUS_SKILL_MECHANICS,
  ...MESMER_WEAPONS_GREATSWORD_SKILL_MECHANICS,
  ...MESMER_WEAPONS_PISTOL_SKILL_MECHANICS,
  ...MESMER_WEAPONS_RIFLE_SKILL_MECHANICS,
  ...MESMER_WEAPONS_SCEPTER_SKILL_MECHANICS,
  ...MESMER_WEAPONS_SHIELD_SKILL_MECHANICS,
  ...MESMER_WEAPONS_SPEAR_SKILL_MECHANICS,
  ...MESMER_WEAPONS_STAFF_SKILL_MECHANICS,
  ...MESMER_WEAPONS_SWORD_SKILL_MECHANICS,
  ...MESMER_WEAPONS_TORCH_SKILL_MECHANICS
});

export { MESMER_CORE_EXTRA_SKILLS } from '#gw2/professions/mesmer/core/skills/actions.js';
export { MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/supplemental-skills.js';
