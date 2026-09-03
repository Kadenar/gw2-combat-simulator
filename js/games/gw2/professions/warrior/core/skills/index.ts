/** Explicit PvE skill mechanics owned by the Core Warrior module. */
import type { SkillFragment } from '#gw2/platform/engine/types.js';
export {
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS,
  WARRIOR_WEAPON_STOW
} from '#gw2/professions/warrior/core/skills/actions.js';
import { WARRIOR_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { WARRIOR_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { WARRIOR_WEAPONS_AXE_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/axe.js';
import { WARRIOR_WEAPONS_DAGGER_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/dagger.js';
import { WARRIOR_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/greatsword.js';
import { WARRIOR_WEAPONS_HAMMER_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/hammer.js';
import { WARRIOR_WEAPONS_LONGBOW_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/longbow.js';
import { WARRIOR_WEAPONS_MACE_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/mace.js';
import { WARRIOR_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/pistol.js';
import { WARRIOR_WEAPONS_RIFLE_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/rifle.js';
import { WARRIOR_WEAPONS_SHIELD_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/shield.js';
import { WARRIOR_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/spear.js';
import { WARRIOR_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/staff.js';
import { WARRIOR_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/sword.js';
import { WARRIOR_WEAPONS_TORCH_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/torch.js';
import { WARRIOR_WEAPONS_WARHORN_SKILL_MECHANICS } from '#gw2/professions/warrior/core/skills/weapons/warhorn.js';

export const WARRIOR_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...WARRIOR_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...WARRIOR_SLOT_SKILLS_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_AXE_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_DAGGER_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_GREATSWORD_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_HAMMER_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_LONGBOW_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_MACE_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_PISTOL_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_RIFLE_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_SHIELD_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_SPEAR_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_STAFF_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_SWORD_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_TORCH_SKILL_MECHANICS,
  ...WARRIOR_WEAPONS_WARHORN_SKILL_MECHANICS
});
