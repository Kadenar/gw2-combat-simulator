/**
 * Owns synthetic Core Mesmer actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the registered skill handlers.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/types.js';

import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';

export const MESMER_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
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
    effects: []
  }
] satisfies readonly MesmerSkill[]);
