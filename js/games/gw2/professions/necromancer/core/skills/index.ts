/**
 * Core skill mechanics owned by the Core Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

import { NECROMANCER_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/profession-skills.js';
import { NECROMANCER_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/slot-skills.js';
import {
  NECROMANCER_WEAPONS_AXE_SKILL_MECHANICS,
  NECROMANCER_AXE_EXTRA_SKILLS
} from '#gw2/professions/necromancer/core/skills/weapons/axe.js';
import { NECROMANCER_CORE_EXTRA_SKILLS as CORE_ACTIONS } from '#gw2/professions/necromancer/core/skills/actions.js';
import { NECROMANCER_WEAPONS_DAGGER_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/dagger.js';
import { NECROMANCER_WEAPONS_FOCUS_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/focus.js';
import { NECROMANCER_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/greatsword.js';
import { NECROMANCER_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/pistol.js';
import { NECROMANCER_WEAPONS_SCEPTER_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/scepter.js';
import { NECROMANCER_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/spear.js';
import { NECROMANCER_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/staff.js';
import { NECROMANCER_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/sword.js';
import { NECROMANCER_WEAPONS_TORCH_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/torch.js';
import { NECROMANCER_WEAPONS_WARHORN_SKILL_MECHANICS } from '#gw2/professions/necromancer/core/skills/weapons/warhorn.js';

/** Lich's replacement bar is shared by cast legality and palette projection; it is not a life-force shroud. */
export const NECROMANCER_LICH_SKILL_IDS: readonly SkillId[] = Object.freeze([
  ID.DEATHLY_CLAWS,
  ID.LICHS_GAZE,
  ID.RIPPLE_OF_HORROR,
  ID.MARCH_OF_UNDEATH,
  ID.SUMMON_MADNESS,
  ID.GRIM_SPECTER,
  ID.EXIT_LICH_FORM
]);

export const NECROMANCER_CORE_BASE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  ...NECROMANCER_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...NECROMANCER_SLOT_SKILLS_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_AXE_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_DAGGER_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_FOCUS_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_GREATSWORD_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_PISTOL_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_SCEPTER_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_SPEAR_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_STAFF_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_SWORD_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_TORCH_SKILL_MECHANICS,
  ...NECROMANCER_WEAPONS_WARHORN_SKILL_MECHANICS
});

// Keep triggered axe identities in the catalog without exposing them as player inputs.
export const NECROMANCER_CORE_EXTRA_SKILLS = Object.freeze([...CORE_ACTIONS, ...NECROMANCER_AXE_EXTRA_SKILLS]);
