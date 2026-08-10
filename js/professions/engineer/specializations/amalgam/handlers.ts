import { engineerAfterEffects } from "../../core/handler-strategies.js";
import {
  activateAmalgamMorph,
  activatePlasmaticState,
  evolveAmalgam,
} from "./amalgam.js";

export const amalgamSkillHandlers = Object.freeze({
  "engineer.amalgam-morph": engineerAfterEffects(activateAmalgamMorph),
  "engineer.evolve": engineerAfterEffects(evolveAmalgam),
  "engineer.plasmatic-state": engineerAfterEffects(activatePlasmaticState),
});
