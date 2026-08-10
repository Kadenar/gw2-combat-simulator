import { augmentAfter, replaceBefore } from "../../core/handler-strategies.js";
import { revenantConduitSkillHandlers } from "./conduit.js";

const handlers = Object.freeze({
  "revenant.beguiling-haze": replaceBefore(
    revenantConduitSkillHandlers["revenant.beguiling-haze"],
  ),
  "revenant.gladiators-defense": replaceBefore(
    revenantConduitSkillHandlers["revenant.gladiators-defense"],
  ),
  "revenant.hex-eater-vortex": replaceBefore(
    revenantConduitSkillHandlers["revenant.hex-eater-vortex"],
  ),
  "revenant.twin-moon-sweep": replaceBefore(
    revenantConduitSkillHandlers["revenant.twin-moon-sweep"],
  ),
  "revenant.release-potential": replaceBefore(
    revenantConduitSkillHandlers["revenant.release-potential"],
  ),
  "revenant.cosmic-wisdom": augmentAfter(
    revenantConduitSkillHandlers["revenant.cosmic-wisdom"],
  ),
});

export const conduitSkillHandlers = new Map(Object.entries(handlers));
