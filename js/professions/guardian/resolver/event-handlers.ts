import { guardianRadiantForgeEventHandlers } from "../mechanics/specific/radiant-forge.js";
import {
  guardianTomeEventHandlers,
  reactToAshesHit,
} from "../mechanics/specific/tomes.js";
import {
  handleVirtueActivation,
  handleVirtueRefresh,
  reactToJusticeHit,
} from "../mechanics/specific/virtues.js";
import {
  handleEffulgentActivated,
  handleEffulgentDetonate,
  handleRighteousInstinctsTick,
  reactToGuardianBuffTraits,
  reactToGuardianDamageTraits,
} from "../mechanics/specific/traits.js";

/**
 * Guardian resolver-side event handlers and reactions. Timeline/state events
 * emitted by the scheduler (virtues, tomes, radiant forge) are folded back into
 * resolver state here, and damage reactions apply trait side effects.
 */
export const guardianResolverEventHandlers = Object.freeze({
  "guardian.virtue-activated": handleVirtueActivation,
  "guardian.virtues-refreshed": handleVirtueRefresh,
  "guardian.effulgent-activated": handleEffulgentActivated,
  "guardian.effulgent-detonate": handleEffulgentDetonate,
  "guardian.righteous-instincts-tick": handleRighteousInstinctsTick,
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
      id: "guardian.traits",
      order: 15,
      handler: reactToGuardianDamageTraits,
    },
    {
      id: "guardian.justice",
      order: 20,
      handler: reactToJusticeHit,
    },
  ]),
  buff: Object.freeze([
    {
      id: "guardian.traits",
      order: 10,
      handler: reactToGuardianBuffTraits,
    },
  ]),
});
