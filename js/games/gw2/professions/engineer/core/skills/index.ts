/**
 * Core Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { ENGINEER_MED_KIT_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/kits/med-kit.js';
import { ENGINEER_GRENADE_KIT_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/kits/grenade-kit.js';
import { ENGINEER_BOMB_KIT_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/kits/bomb-kit.js';
import { ENGINEER_FLAMETHROWER_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/kits/flamethrower.js';
import { ENGINEER_ELIXIR_GUN_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/kits/elixir-gun.js';
import { ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/kits/elite-mortar-kit.js';

import { ENGINEER_SUPPLEMENTAL_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/supplemental-skills.js';
import { ENGINEER_TRAIT_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/trait-skills.js';
import { ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/profession-skills.js';
import { ENGINEER_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/slot-skills.js';
import { ENGINEER_WEAPONS_HAMMER_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/weapons/hammer.js';
import { ENGINEER_WEAPONS_MACE_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/weapons/mace.js';
import { ENGINEER_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/weapons/pistol.js';
import { ENGINEER_WEAPONS_RIFLE_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/weapons/rifle.js';
import { ENGINEER_WEAPONS_SHIELD_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/weapons/shield.js';
import { ENGINEER_WEAPONS_SHORTBOW_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/weapons/shortbow.js';
import { ENGINEER_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/weapons/spear.js';
import { ENGINEER_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/professions/engineer/core/skills/weapons/sword.js';

/** Composes kit fragments with physical weapons, utilities, toolbelt actions, and synthetic Core skills. */
export const ENGINEER_CORE_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  ...ENGINEER_TRAIT_SKILL_MECHANICS,
  ...ENGINEER_SUPPLEMENTAL_SKILL_MECHANICS,
  ...ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...ENGINEER_SLOT_SKILLS_SKILL_MECHANICS,
  ...ENGINEER_WEAPONS_HAMMER_SKILL_MECHANICS,
  ...ENGINEER_WEAPONS_MACE_SKILL_MECHANICS,
  ...ENGINEER_WEAPONS_PISTOL_SKILL_MECHANICS,
  ...ENGINEER_WEAPONS_RIFLE_SKILL_MECHANICS,
  ...ENGINEER_WEAPONS_SHIELD_SKILL_MECHANICS,
  ...ENGINEER_WEAPONS_SHORTBOW_SKILL_MECHANICS,
  ...ENGINEER_WEAPONS_SPEAR_SKILL_MECHANICS,
  ...ENGINEER_WEAPONS_SWORD_SKILL_MECHANICS,
  ...ENGINEER_MED_KIT_SKILL_MECHANICS,
  ...ENGINEER_GRENADE_KIT_SKILL_MECHANICS,
  ...ENGINEER_BOMB_KIT_SKILL_MECHANICS,
  ...ENGINEER_FLAMETHROWER_SKILL_MECHANICS,
  ...ENGINEER_ELIXIR_GUN_SKILL_MECHANICS,
  ...ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS
});
export { ENGINEER_CORE_EXTRA_SKILLS } from '#gw2/professions/engineer/core/skills/actions.js';
