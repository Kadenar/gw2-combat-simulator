/** Registers scheduler-phase skill activations for this module. */
import { augmentSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import {
  activateAmalgamMorph,
  activatePlasmaticState,
  evolveAmalgam
} from '#gw2/content/professions/engineer/specializations/amalgam/mechanics/evolved-form.js';

// Maps handlerId values declared in skills.ts to their afterEffects callbacks.
// `afterEffects` runs once all skill-defined damage/condition ticks have been
// emitted, letting these functions emit trait procs without ordering conflicts.
export const amalgamSkillHandlers = Object.freeze({
  'engineer.amalgam-morph': augmentSkill({
    afterEffects: activateAmalgamMorph
  }),
  'engineer.evolve': augmentSkill({ afterEffects: evolveAmalgam }),
  'engineer.plasmatic-state': augmentSkill({
    afterEffects: activatePlasmaticState
  })
});
