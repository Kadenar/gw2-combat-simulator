import { augmentSkill, replaceSkill } from '../../../platform/gw2/native-profession.js';
import { gw2WeaponSwapSkillHandler } from '../../../platform/gw2/weapon-swap.js';
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
