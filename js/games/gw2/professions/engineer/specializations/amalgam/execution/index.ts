import { augmentSkill } from '#gw2/platform/profession-definition/mechanics.js';
import {
  activateAmalgamMorph,
  activatePlasmaticState,
  evolveAmalgam
} from '#gw2/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';

/** Runs Amalgam state transitions after each skill's authored effects. */
export const amalgamSkillHandlers = Object.freeze({
  'engineer.amalgam-morph': augmentSkill({ afterEffects: activateAmalgamMorph }),
  'engineer.evolve': augmentSkill({ afterEffects: evolveAmalgam }),
  'engineer.plasmatic-state': augmentSkill({ afterEffects: activatePlasmaticState })
});
