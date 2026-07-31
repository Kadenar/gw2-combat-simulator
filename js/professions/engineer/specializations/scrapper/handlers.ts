import {
  scrapperResolverEventHandlers,
  scrapperResolverEventReactions,
} from "./resolver.js";
import {
  applyScrapperCastTraits,
} from "./traits.js";

export const scrapperSkillHandlers = Object.freeze({});

export const scrapperSchedulerHooks = Object.freeze({
  afterCast: {
    id: "engineer.scrapper-traits",
    order: 30,
    handler: applyScrapperCastTraits,
  },
});

export const scrapperEventHandlers = scrapperResolverEventHandlers;
export const scrapperEventReactions = scrapperResolverEventReactions;
