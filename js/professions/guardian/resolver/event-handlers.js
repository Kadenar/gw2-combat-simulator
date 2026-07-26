import {
  guardianRadiantForgeEventHandlers,
} from "../mechanics/radiant-forge.js";
import {
  guardianTomeEventHandlers,
  reactToAshesHit,
} from "../mechanics/tomes.js";
import {
  handleVirtueActivation,
  handleVirtueRefresh,
  reactToJusticeHit,
} from "../mechanics/virtues.js";

/**
 * Guardian resolver-side event handlers and reactions. Timeline/state events
 * emitted by the scheduler (virtues, tomes, radiant forge) are folded back into
 * resolver state here, and damage reactions apply trait side effects.
 */
export const guardianResolverEventHandlers = Object.freeze({
  "guardian.virtue-activated": handleVirtueActivation,
  "guardian.virtues-refreshed": handleVirtueRefresh,
  ...guardianTomeEventHandlers,
  ...guardianRadiantForgeEventHandlers,
});

export const guardianResolverEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "guardian.ashes-of-the-just",
      order: 10,
      handler: reactToAshesHit,
    },
    {
      id: "guardian.justice",
      order: 20,
      handler: reactToJusticeHit,
    },
  ]),
});
