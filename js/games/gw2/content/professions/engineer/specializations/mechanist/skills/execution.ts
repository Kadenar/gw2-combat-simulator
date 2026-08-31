/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import {
  activateOverclockSignet,
  engineerMechSkillHandlers
} from '#gw2/content/professions/engineer/specializations/mechanist/mechanics/mech.js';

// Run lifecycle changes after authored skill effects: summon/recall toggle the
// autonomous mech loop, while Overclock schedules its separate cannon sequence.
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
