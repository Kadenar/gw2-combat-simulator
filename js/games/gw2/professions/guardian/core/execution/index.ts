import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '#gw2/platform/equipment/weapons/swap.js';
import { guardianVirtueSkillHandlers } from '#gw2/professions/guardian/core/mechanics/virtues.js';

/** Binds Core Guardian virtues and weapon swap to their scheduler strategies. */
export const guardianCoreSkillHandlers = Object.freeze({
  'guardian.virtue': augmentSkill({ beforeEffects: guardianVirtueSkillHandlers['guardian.virtue'] }),
  'guardian.renewed-focus': replaceSkill({
    beforeEffects: guardianVirtueSkillHandlers['guardian.renewed-focus']
  }),
  'guardian.weapon-swap': gw2WeaponSwapSkillHandler
});
