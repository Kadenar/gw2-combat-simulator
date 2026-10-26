import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_DODGE: Skill = Object.freeze(
  createDodgeSkill({
    rechargeAnchor: 'castStart'
  })
);

export const WARRIOR_SWAP_WEAPONS: Skill = Object.freeze(createWeaponSwapSkill({ cooldown: 5 }));
