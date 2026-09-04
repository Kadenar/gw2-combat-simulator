/**
 * Owns synthetic Core Ranger actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the named execution and mechanic owners.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_ACTION_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.DODGE,
    name: 'Dodge',
    description: 'Perform a dodge roll.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    weapon: '',
    slot: 'Action',
    castTimeMs: 800,
    unaffectedByQuickness: true,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    // Custom: Spends endurance and applies Ranger dodge traits; see `execution/index.ts`.
    handlerId: 'ranger.dodge',
    effects: []
  },
  {
    id: ID.PET_SWAP,
    name: 'Swap Pets',
    description: 'Swap your active pet and trigger pet-swap traits.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    weapon: '',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    // Custom: Switches pet slots and applies pet-swap traits; see `execution/index.ts`.
    handlerId: 'ranger.pet-swap',
    effects: []
  },
  {
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Swap to your alternate weapon set.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    // Custom: Performs the shared weapon-set transition; see `platform/equipment/weapons/swap.ts`.
    handlerId: 'ranger.weapon-swap',
    effects: []
  }
]);
