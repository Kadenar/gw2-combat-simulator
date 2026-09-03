/**
 * Owns simulator-only Core Revenant action declarations.
 * Their runtime behavior is registered through `execution/index.ts`.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/engine/types.js';

const actions: readonly Skill[] = [
  {
    id: ID.SWAP_WEAPONS,
    // Custom: Performs the shared weapon-set transition; see `platform/equipment/weapons/swap.ts`.
    handlerId: 'revenant.weapon-swap',
    name: 'Swap Weapons',
    description: 'Swap equipped weapon sets.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    cooldown: 10,
    rechargeAnchor: 'castStart',
    effects: []
  },
  {
    id: ID.SWAP_LEGENDS,
    // Custom: Switches legends and resets energy through `core/mechanics/legend-swap.ts`.
    handlerId: 'revenant.legend-swap',
    name: 'Swap Legends',
    description: 'Invoke the other selected legend and reset energy.',
    icon: '',
    type: 'Profession',
    slot: 'Profession_1',
    castTimeMs: 0,
    cooldown: 10,
    resourceGain: 50,
    effects: []
  },
  {
    id: ID.DODGE,
    // Custom: Spends endurance and emits Revenant dodge state through `execution/actions.ts`.
    handlerId: 'revenant.dodge',
    name: 'Dodge',
    description: 'Perform the selected dodge.',
    icon: 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    cooldown: 0,
    resourceCost: 50,
    effects: []
  }
];

export const REVENANT_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze(actions.map((skill) => Object.freeze(skill)));
