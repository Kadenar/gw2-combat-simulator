import {
  revenantCoreResolverEventHandlers,
  revenantCoreResolverEventReactions,
} from "./core/resolver.js";
import { revenantRenegadeEventReactions } from "./specializations/renegade/resolver.js";

export const revenantResolverEventHandlers =
  revenantCoreResolverEventHandlers;

export const revenantResolverEventReactions = Object.freeze({
  ...revenantCoreResolverEventReactions,
  ...revenantRenegadeEventReactions,
});
