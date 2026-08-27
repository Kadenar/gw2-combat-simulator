import { augmentSkill, replaceSkill } from '../../../../integrations/patches/authoring/mechanics.js';
import { gw2WeaponSwapSkillHandler } from '../../../../platform/equipment/weapons/swap.js';
import { guardianVirtueSkillHandlers } from './virtues.js';

export const guardianCoreSkillHandlers = Object.freeze({
  'guardian.virtue': augmentSkill({
    beforeEffects: guardianVirtueSkillHandlers['guardian.virtue']
  }),
  'guardian.renewed-focus': replaceSkill({
    beforeEffects: guardianVirtueSkillHandlers['guardian.renewed-focus']
  }),
  'guardian.weapon-swap': gw2WeaponSwapSkillHandler
});
