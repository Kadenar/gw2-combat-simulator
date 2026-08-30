import { expireThievesGuild, handleThievesGuildAttack } from '../skills/actions.js';

export const thiefCoreTaskHandlers = Object.freeze({
  'thief.thieves-guild-attack': handleThievesGuildAttack,
  'thief.thieves-guild-expire': expireThievesGuild
});
