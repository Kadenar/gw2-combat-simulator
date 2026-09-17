import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { activateOverclockSignet } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech.js';

/** Schedules Overclock after authored skill effects. */
export const mechanistSkillHandlers = Object.freeze({
  'engineer.overclock-signet': augmentSkill({ afterEffects: activateOverclockSignet })
});
