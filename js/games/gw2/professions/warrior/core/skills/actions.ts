import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';

export const WARRIOR_DODGE: Skill = Object.freeze(
  createDodgeSkill({
    cost: { resource: 'endurance' as const, profileAmount: { profileId: PROFILE.resources, field: 'resourceCost' } },
    rechargeAnchor: 'castStart'
  })
);

export const WARRIOR_SWAP_WEAPONS: Skill = Object.freeze(createWeaponSwapSkill({ cooldown: 5 }));
