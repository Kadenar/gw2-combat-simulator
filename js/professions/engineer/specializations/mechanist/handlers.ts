import { engineerAfterEffects } from "../../core/handler-strategies.js";
import { activateOverclockSignet, engineerMechSkillHandlers } from "./mech.js";

export const mechanistSkillHandlers = Object.freeze({
  "engineer.mech-summon": engineerAfterEffects(
    engineerMechSkillHandlers["engineer.mech-summon"],
  ),
  "engineer.mech-recall": engineerAfterEffects(
    engineerMechSkillHandlers["engineer.mech-recall"],
  ),
  "engineer.overclock-signet": engineerAfterEffects(activateOverclockSignet),
});
