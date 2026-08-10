import { engineerAfterEffects } from "../../core/handler-strategies.js";
import { engineerPhotonForgeSkillHandlers } from "./photon-forge.js";

export const holosmithSkillHandlers = Object.freeze({
  "engineer.photon-forge-enter": engineerAfterEffects(
    engineerPhotonForgeSkillHandlers["engineer.photon-forge-enter"],
  ),
  "engineer.photon-forge-exit": engineerAfterEffects(
    engineerPhotonForgeSkillHandlers["engineer.photon-forge-exit"],
  ),
  "engineer.heat": engineerAfterEffects(
    engineerPhotonForgeSkillHandlers["engineer.heat"],
  ),
});
