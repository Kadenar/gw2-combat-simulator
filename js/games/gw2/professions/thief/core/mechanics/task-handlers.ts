import { expireThievesGuild, handleThievesGuildAttack } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import {
  handleStealthBreakingStrike,
  THIEF_BREAK_STEALTH_TASK
} from '#gw2/professions/thief/core/mechanics/stealth.js';

export const thiefCoreTaskHandlers = Object.freeze({
  [THIEF_BREAK_STEALTH_TASK]: handleStealthBreakingStrike,
  'thief.thieves-guild-attack': handleThievesGuildAttack,
  'thief.thieves-guild-expire': expireThievesGuild
});
