import {
  engineerAfterEffects,
} from "../../core/handler-strategies.js";
import {
  activateAmalgamMorph,
  activatePlasmaticState,
  evolveAmalgam,
  handleMercurialTendencies,
  observeAmalgamScheduledEvent,
} from "./amalgam.js";
import {
  amalgamResolverEventReactions,
} from "./resolver.js";

export const amalgamSkillHandlers = Object.freeze({
  "engineer.amalgam-morph": engineerAfterEffects(activateAmalgamMorph),
  "engineer.evolve": engineerAfterEffects(evolveAmalgam),
  "engineer.plasmatic-state": engineerAfterEffects(activatePlasmaticState),
});

export const amalgamSchedulerHooks = Object.freeze({
  onEventScheduled: {
    id: "engineer.amalgam-events",
    order: 20,
    handler: observeAmalgamScheduledEvent,
  },
  taskHandlers: Object.freeze({
    "engineer.mercurial-tendencies": handleMercurialTendencies,
  }),
});

export const amalgamEventReactions = amalgamResolverEventReactions;
