import { expireThievesGuild, handleThievesGuildAttack } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { stealthBreakingReaction } from '#gw2/professions/thief/core/mechanics/stealth.js';

export const thiefCoreTaskHandlers = Object.freeze({
  ...stealthBreakingReaction.taskHandlers,
  'thief.thieves-guild-attack': handleThievesGuildAttack,
  'thief.thieves-guild-expire': expireThievesGuild
});
