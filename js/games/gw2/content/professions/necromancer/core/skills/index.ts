/**
 * Core skill mechanics owned by the Core Necromancer module.
 *
 * The root catalog composes this inert fragment with the other active module
 * fragments. Weapon skills remain Core-owned because Weaponmaster Training
 * makes elite weapon families profession-wide.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/types.js';
import { NECROMANCER_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/profession-skills.js';
import { NECROMANCER_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/slot-skills.js';
import { NECROMANCER_WEAPONS_AXE_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/axe.js';
import { NECROMANCER_WEAPONS_DAGGER_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/dagger.js';
import { NECROMANCER_WEAPONS_FOCUS_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/focus.js';
import { NECROMANCER_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/greatsword.js';
import { NECROMANCER_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/pistol.js';
import { NECROMANCER_WEAPONS_SCEPTER_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/scepter.js';
import { NECROMANCER_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/spear.js';
import { NECROMANCER_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/staff.js';
import { NECROMANCER_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/sword.js';
import { NECROMANCER_WEAPONS_TORCH_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/torch.js';
import { NECROMANCER_WEAPONS_WARHORN_SKILL_MECHANICS } from '#gw2/content/professions/necromancer/core/skills/weapons/warhorn.js';

export const NECROMANCER_CORE_BASE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
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

export const NECROMANCER_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  Object.freeze({
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Swap between weapon sets. The swap has a 10-second recharge.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    implemented: true,
    // Custom: Performs the shared weapon-set transition; see `platform/equipment/weapons/swap.ts`.
    handlerId: 'necromancer.weapon-swap',
    effects: []
  }),
  Object.freeze({
    id: ID.EXIT_LICH_FORM,
    name: 'Exit Lich Form',
    description: 'Leave Lich Form and return to your normal skill bar.',
    icon: 'https://render.guildwars2.com/file/A6CAF2146D9DF2EBEFD9285CB0E9E3617A659071/1770528.png',
    type: 'Profession',
    slot: 'Profession_1',
    castTimeMs: 0,
    cooldown: 0,
    implemented: true,
    // Custom: Enters or exits Lich Form and updates transform state; see `core/mechanics/shroud.ts`.
    handlerId: 'necromancer.lich',
    flipParentId: ID.LICH_FORM,
    flipParent: 'Lich Form',
    effects: []
  })
]);
