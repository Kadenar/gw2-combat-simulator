import { augmentSkill } from '../../../../platform/gw2/native-profession.js';
import { activateOverclockSignet, engineerMechSkillHandlers } from './mech.js';

export const mechanistSkillHandlers = Object.freeze({
  'engineer.mech-summon': augmentSkill({
    afterEffects: engineerMechSkillHandlers['engineer.mech-summon']
  }),
  'engineer.mech-recall': augmentSkill({
    afterEffects: engineerMechSkillHandlers['engineer.mech-recall']
  }),
  'engineer.overclock-signet': augmentSkill({
    afterEffects: activateOverclockSignet
  })
});
