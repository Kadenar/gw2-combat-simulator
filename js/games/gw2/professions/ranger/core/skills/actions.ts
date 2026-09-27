import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns synthetic Core Ranger actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the named execution and mechanic owners.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';

export const RANGER_CORE_ACTION_SKILLS: readonly Skill[] = Object.freeze([
  createDodgeSkill({
    rechargeAnchor: 'castStart',
    cost: { resource: 'endurance', profileAmount: { profileId: PROFILE.resources, field: 'resourceCost' } }
  }),
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
    // Custom: Switches pet slots and applies pet-swap traits; see `hooks.ts`.

    effects: []
  },
  createWeaponSwapSkill()
]);
