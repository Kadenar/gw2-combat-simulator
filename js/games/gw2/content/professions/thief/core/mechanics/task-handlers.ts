import { expireThievesGuild, handleThievesGuildAttack } from '#gw2/content/professions/thief/core/skills/actions.js';

export const thiefCoreTaskHandlers = Object.freeze({
  'thief.thieves-guild-attack': handleThievesGuildAttack,
  'thief.thieves-guild-expire': expireThievesGuild
});
