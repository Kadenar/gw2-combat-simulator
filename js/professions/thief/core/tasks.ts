import { expireThievesGuild, handleThievesGuildAttack } from "./actions.js";
import {
  handleCaltropsPulse,
  handleThousandNeedlesPulse,
} from "./conditions.js";

export const thiefCoreTaskHandlers = Object.freeze({
  "thief.thieves-guild-attack": handleThievesGuildAttack,
  "thief.thieves-guild-expire": expireThievesGuild,
  "thief.thousand-needles-pulse": handleThousandNeedlesPulse,
  "thief.caltrops-pulse": handleCaltropsPulse,
});
