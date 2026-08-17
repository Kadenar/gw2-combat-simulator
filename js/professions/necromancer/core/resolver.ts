import {
  handleNecromancerChillEvent,
  handleNecromancerReviveEvent,
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack,
} from "./events.js";
import {
  reactToNecromancerBlind,
  reactToNecromancerCoreCondition,
  reactToNecromancerCoreControl,
  reactToNecromancerCoreDamage,
} from "./traits.js";

/**
 * Necromancer resolver-side handlers for profession state and summon events.
 */
export const necromancerCoreResolverEventHandlers = Object.freeze({
  "necromancer.state": handleNecromancerStateEvent,
  "necromancer.chill": handleNecromancerChillEvent,
  "necromancer.revive": handleNecromancerReviveEvent,
  "necromancer.summon-attack": handleNecromancerSummonAttack,
});

/**
 * Ordered Core reaction descriptors consumed by the native module wiring.
 * Order zero preserves the previous Core-before-specialization dispatch order.
 */
export const necromancerCoreResolverEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "necromancer.core.damage",
      order: 0,
      handler: reactToNecromancerCoreDamage,
    },
  ]),
  condition: Object.freeze([
    {
      id: "necromancer.core.condition",
      order: 0,
      handler: reactToNecromancerCoreCondition,
    },
  ]),
  blind: Object.freeze([
    {
      id: "necromancer.core.blind",
      order: 0,
      handler: reactToNecromancerBlind,
    },
  ]),
  control: Object.freeze([
    {
      id: "necromancer.core.control",
      order: 0,
      handler: reactToNecromancerCoreControl,
    },
  ]),
});
