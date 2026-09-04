import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';
import { THIEF_MISC_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/misc-skills.js';
import { THIEF_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/profession-skills.js';
import { THIEF_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/slot-skills.js';
import { THIEF_WEAPONS_AXE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/axe.js';
import { THIEF_WEAPONS_DAGGER_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/dagger.js';
import { THIEF_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/pistol.js';
import { THIEF_WEAPONS_RIFLE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/rifle.js';
import { THIEF_WEAPONS_SCEPTER_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/scepter.js';
import { THIEF_WEAPONS_SHORTBOW_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/shortbow.js';
import { THIEF_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/spear.js';
import { THIEF_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/staff.js';
import { THIEF_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/weapons/sword.js';

export const THIEF_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...THIEF_MISC_SKILL_MECHANICS,
  ...THIEF_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...THIEF_SLOT_SKILLS_SKILL_MECHANICS,
  ...THIEF_WEAPONS_AXE_SKILL_MECHANICS,
  ...THIEF_WEAPONS_DAGGER_SKILL_MECHANICS,
  ...THIEF_WEAPONS_PISTOL_SKILL_MECHANICS,
  ...THIEF_WEAPONS_RIFLE_SKILL_MECHANICS,
  ...THIEF_WEAPONS_SCEPTER_SKILL_MECHANICS,
  ...THIEF_WEAPONS_SHORTBOW_SKILL_MECHANICS,
  ...THIEF_WEAPONS_SPEAR_SKILL_MECHANICS,
  ...THIEF_WEAPONS_STAFF_SKILL_MECHANICS,
  ...THIEF_WEAPONS_SWORD_SKILL_MECHANICS
});

export const THIEF_CORE_EXTRA_SKILLS: readonly ThiefSkill[] = Object.freeze([
  Object.freeze({
    id: ID.SWAP_WEAPONS,
    // Custom: Performs the shared weapon-set transition; see `platform/equipment/weapons/swap.ts`.
    handlerId: 'thief.weapon-swap',
    name: 'Swap Weapons',
    description: 'Swap equipped weapon sets.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    cooldown: 10,
    rechargeAnchor: 'castStart',
    effects: []
  }),
  Object.freeze({
    id: ID.DODGE,
    // Custom: Spends endurance and applies Thief dodge traits; see `core/skills/dodge.ts`.
    handlerId: 'thief.dodge',
    name: 'Dodge',
    description: 'Perform the selected thief dodge.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 800,
    unaffectedByQuickness: true,
    cooldown: 0,
    effects: []
  })
]);
