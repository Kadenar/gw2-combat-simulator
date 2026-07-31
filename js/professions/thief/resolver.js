import {
  thiefCoreResolverEventHandlers,
  thiefCoreResolverEventReactions,
} from "./core/resolver.js";
import {
  antiquaryResolverEventReactions,
} from "./specializations/antiquary/resolver.js";

export const thiefResolverEventHandlers = thiefCoreResolverEventHandlers;

export const thiefResolverEventReactions = Object.freeze({
  damage: Object.freeze([
    thiefCoreResolverEventReactions.damage,
    antiquaryResolverEventReactions.damage,
  ]),
  condition: thiefCoreResolverEventReactions.condition,
});
