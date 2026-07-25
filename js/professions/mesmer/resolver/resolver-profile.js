import { EPSILON } from "../../../platform/engine/clock.js";
import {
  createEventReactions,
} from "../../../platform/engine/profession.js";
import {
  createGw2ResolverEventHandlers,
} from "../../../platform/gw2/resolver/event-handlers.js";
import {
  activeConditionStackCount,
  applyCondition,
  handleConditionTick,
} from "./condition-resolution.js";
import {
  mesmerResolverEventReactions,
} from "./event-handlers.js";
import {
  applyResolvedHit,
  buildHitResolutionContext,
} from "./hit-resolution.js";

export const mesmerCommonResolverEventHandlers = createGw2ResolverEventHandlers({
  hitResolution: {
    buildContext: buildHitResolutionContext,
    apply: applyResolvedHit,
  },
  conditions: {
    activeStackCount: activeConditionStackCount,
    apply: applyCondition,
    tick: handleConditionTick,
  },
  eventReactions: createEventReactions(mesmerResolverEventReactions),
});

export function shouldSkipMesmerResolverEvent(ctx, event) {
  if (!event.cloneId) return false;
  const cloneDeaths = ctx.eventFilterState?.cloneDeaths || new Map();
  const destroyedAt = cloneDeaths.get(event.cloneId) ?? Infinity;
  return destroyedAt <= event.at + EPSILON;
}
