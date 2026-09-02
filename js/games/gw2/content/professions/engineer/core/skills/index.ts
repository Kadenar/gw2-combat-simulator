/**
 * Core Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { Skill, SkillFragment } from '#gw2/platform/engine/types.js';
import { ENGINEER_MED_KIT_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/kits/med-kit.js';
import { ENGINEER_GRENADE_KIT_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/kits/grenade-kit.js';
import { ENGINEER_BOMB_KIT_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/kits/bomb-kit.js';
import { ENGINEER_FLAMETHROWER_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/kits/flamethrower.js';
import { ENGINEER_ELIXIR_GUN_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/kits/elixir-gun.js';
import {
  ENGINEER_ELITE_MORTAR_KIT_SKILL_MECHANICS,
  ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS
} from '#gw2/content/professions/engineer/core/skills/kits/elite-mortar-kit.js';

import { ENGINEER_MISC_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/misc-skills.js';
import { ENGINEER_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/profession-skills.js';
import { ENGINEER_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/slot-skills.js';
import { ENGINEER_WEAPONS_HAMMER_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/weapons/hammer.js';
import { ENGINEER_WEAPONS_MACE_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/weapons/mace.js';
import { ENGINEER_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/weapons/pistol.js';
import { ENGINEER_WEAPONS_RIFLE_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/weapons/rifle.js';
import { ENGINEER_WEAPONS_SHIELD_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/weapons/shield.js';
import { ENGINEER_WEAPONS_SHORTBOW_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/weapons/shortbow.js';
import { ENGINEER_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/weapons/spear.js';
import { ENGINEER_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/content/professions/engineer/core/skills/weapons/sword.js';

/** Composes kit fragments with physical weapons, utilities, toolbelt actions, and synthetic Core skills. */
export const ENGINEER_CORE_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  ...ENGINEER_MISC_SKILLS_SKILL_MECHANICS,
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
const extraSkills: Skill[] = [
  ...ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS,
  {
    id: ID.DODGE,
    name: 'Dodge',
    description: 'Perform a dodge roll.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    // Custom: Spends endurance and emits the Engineer dodge state; see `core/skills/dodge.ts`.
    handlerId: 'engineer.dodge',
    // Quickness does not shorten the fixed evade animation recorded for ordinary dodge rolls.
    unaffectedByQuickness: true,
    castTimeMs: 800,
    cooldown: 0,
    effects: []
  },
  {
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Stow the active engineer kit and return to equipped weapons.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    handlerId: 'engineer.kit-stow',
    castTimeMs: 0,
    cooldown: 0,
    rechargeAnchor: 'castStart',
    effects: []
  }
];
/** Supplies synthetic Core actions that do not come from the GW2 skill catalog. */
export const ENGINEER_CORE_EXTRA_SKILLS = Object.freeze(extraSkills.map((skill) => Object.freeze(skill)));
