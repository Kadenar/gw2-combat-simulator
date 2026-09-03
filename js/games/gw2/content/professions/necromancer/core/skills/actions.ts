/**
 * Owns synthetic Core Necromancer actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the platform weapon-swap and Core shroud mechanic owners.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/content/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/types.js';

const extraSkills: Skill[] = [
  {
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Swap between weapon sets. The swap has a 10-second recharge.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    // Custom: Performs the shared weapon-set transition; see `platform/equipment/weapons/swap.ts`.
    handlerId: 'necromancer.weapon-swap',
    effects: []
  },
  {
    id: ID.EXIT_LICH_FORM,
    name: 'Exit Lich Form',
    description: 'Leave Lich Form and return to your normal skill bar.',
    icon: 'https://render.guildwars2.com/file/A6CAF2146D9DF2EBEFD9285CB0E9E3617A659071/1770528.png',
    type: 'Profession',
    slot: 'Profession_1',
    castTimeMs: 0,
    cooldown: 0,
    // Custom: Enters or exits Lich Form and updates transform state; see `core/mechanics/shroud.ts`.
    handlerId: 'necromancer.lich',
    flipParentId: ID.LICH_FORM,
    flipParent: 'Lich Form',
    effects: []
  }
];

/** Supplies the frozen synthetic-action catalog to Core module composition. */
export const NECROMANCER_CORE_EXTRA_SKILLS = Object.freeze(extraSkills.map((skill) => Object.freeze(skill)));
