import { thievesGuildTaskHandlers } from '#gw2/professions/thief/core/mechanics/thieves-guild.js';
import { stealthBreakingReaction } from '#gw2/professions/thief/core/mechanics/stealth.js';
import { thiefEnduranceGrant } from '#gw2/professions/thief/core/mechanics/resource-events.js';

export const thiefCoreTaskHandlers = Object.freeze({
  ...thiefEnduranceGrant.taskHandlers,
  ...stealthBreakingReaction.taskHandlers,
  ...thievesGuildTaskHandlers
});
