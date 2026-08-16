import { augmentSkill } from "../../../../platform/gw2/native-profession.js";
import {
  activateAmalgamMorph,
  activatePlasmaticState,
  evolveAmalgam,
} from "./amalgam.js";

// Maps handlerId values declared in skills.ts to their afterEffects callbacks.
// `afterEffects` runs once all skill-defined damage/condition ticks have been
// emitted, letting these functions emit trait procs without ordering conflicts.
export const amalgamSkillHandlers = Object.freeze({
  "engineer.amalgam-morph": augmentSkill({
    afterEffects: activateAmalgamMorph,
  }),
  "engineer.evolve": augmentSkill({ afterEffects: evolveAmalgam }),
  "engineer.plasmatic-state": augmentSkill({
    afterEffects: activatePlasmaticState,
  }),
});
