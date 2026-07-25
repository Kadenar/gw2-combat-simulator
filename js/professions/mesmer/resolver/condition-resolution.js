import {
  createGw2ConditionResolution,
} from "../../../platform/gw2/resolver/condition-resolution.js";
import {
  createEventReactions,
} from "../../../platform/engine/profession.js";
import {
  mesmerResolverEventReactions,
} from "./event-handlers.js";

const eventReactions = createEventReactions(mesmerResolverEventReactions);
const conditionResolution = createGw2ConditionResolution({
  onConditionApplied(ctx, application) {
    eventReactions.condition(ctx, application, { application });
  },
});

export const {
  activeConditionStackCount,
  applyCondition,
  handleConditionTick,
} = conditionResolution;
