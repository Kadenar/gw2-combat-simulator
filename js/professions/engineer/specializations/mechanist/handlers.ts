import {
  engineerAfterEffects,
} from "../../core/handler-strategies.js";
import {
  activateOverclockSignet,
  applyEngineerMechCastTraits,
  engineerMechSkillHandlers,
  handleEngineerMechAttack,
  initializeEngineerMech,
  observeEngineerMechEvent,
} from "./mech.js";
import {
  mechanistResolverEventReactions,
} from "./resolver.js";

export const mechanistSkillHandlers = Object.freeze({
  "engineer.mech-summon": engineerAfterEffects(
    engineerMechSkillHandlers["engineer.mech-summon"],
  ),
  "engineer.mech-recall": engineerAfterEffects(
    engineerMechSkillHandlers["engineer.mech-recall"],
  ),
  "engineer.overclock-signet": engineerAfterEffects(
    activateOverclockSignet,
  ),
});

export const mechanistSchedulerHooks = Object.freeze({
  initialize: {
    id: "engineer.mech-initialize",
    order: 10,
    handler: initializeEngineerMech,
  },
  onEventScheduled: {
    id: "engineer.mech-events",
    order: 10,
    handler: observeEngineerMechEvent,
  },
  afterCast: {
    id: "engineer.mech-traits",
    order: 30,
    handler: applyEngineerMechCastTraits,
  },
  taskHandlers: Object.freeze({
    "engineer.mech-attack": handleEngineerMechAttack,
  }),
});

export const mechanistEventReactions = mechanistResolverEventReactions;
