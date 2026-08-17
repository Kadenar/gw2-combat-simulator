import { expireThievesGuild, handleThievesGuildAttack } from "./actions.js";

export const thiefCoreTaskHandlers = Object.freeze({
  "thief.thieves-guild-attack": handleThievesGuildAttack,
  "thief.thieves-guild-expire": expireThievesGuild,
});
