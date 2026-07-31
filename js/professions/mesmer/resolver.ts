import {
  mesmerCoreEventHandlers,
  mesmerCoreEventReactions,
} from "./core/resolver.js";
import { troubadourEventHandlers } from "./specializations/troubadour/resolver.js";

export const mesmerResolverEventHandlers = Object.freeze({
  ...mesmerCoreEventHandlers,
  ...troubadourEventHandlers,
});

export const mesmerResolverEventReactions = mesmerCoreEventReactions;
