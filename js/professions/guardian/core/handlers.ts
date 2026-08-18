import { augmentSkill, replaceSkill } from '../../../platform/gw2/native-profession.js';
import { guardianVirtueSkillHandlers } from './virtues.js';
import { guardianWeaponSkillHandlers } from './weapon-state.js';

export const guardianCoreSkillHandlers = Object.freeze({
  'guardian.virtue': augmentSkill({
    beforeEffects: guardianVirtueSkillHandlers['guardian.virtue']
  }),
  'guardian.renewed-focus': replaceSkill({
    beforeEffects: guardianVirtueSkillHandlers['guardian.renewed-focus']
  }),
  'guardian.weapon-swap': replaceSkill({
    beforeEffects: guardianWeaponSkillHandlers['guardian.weapon-swap']
  })
});
