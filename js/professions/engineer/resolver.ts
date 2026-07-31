import {
  engineerCoreResolverEventHandlers,
  engineerCoreResolverEventReactions,
} from "./core/resolver.js";
import {
  amalgamResolverEventReactions,
} from "./specializations/amalgam/resolver.js";
import {
  holosmithResolverEventHandlers,
} from "./specializations/holosmith/resolver.js";
import {
  mechanistResolverEventReactions,
} from "./specializations/mechanist/resolver.js";
import {
  scrapperResolverEventHandlers,
  scrapperResolverEventReactions,
} from "./specializations/scrapper/resolver.js";

export const engineerResolverEventHandlers = Object.freeze({
  ...engineerCoreResolverEventHandlers,
  ...scrapperResolverEventHandlers,
  ...holosmithResolverEventHandlers,
});

export const engineerResolverEventReactions = Object.freeze({
  damage: [
    engineerCoreResolverEventReactions.damage,
    scrapperResolverEventReactions.damage,
    mechanistResolverEventReactions.damage,
    amalgamResolverEventReactions.damage,
  ],
  condition: engineerCoreResolverEventReactions.condition,
  buff: scrapperResolverEventReactions.buff,
});
