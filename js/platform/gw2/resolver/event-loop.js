import { EPSILON } from "../../engine/clock.js";
import {
  sortQueuedEvents,
  takeNextEvent,
} from "../../engine/event-queue.js";
import { HandlerRegistry } from "../../engine/handler-registry.js";

export function createGw2ResolverHandlerRegistry({
  commonHandlers = {},
  professionHandlers = {},
} = {}) {
  return new HandlerRegistry()
    .registerAll(commonHandlers)
    .registerAll(professionHandlers);
}

function targetHealth(ctx) {
  const value = Number(
    ctx.config.target?.health
    ?? ctx.config.targetHP
    ?? 0,
  );
  return value > 0 ? value : Infinity;
}

/**
 * Drains a GW2 resolver queue. Professions may filter their own actor events,
 * but time ordering, encounter bounds, combat start, target death, and handler
 * dispatch remain common.
 */
export function runGw2ResolverEventLoop(
  ctx,
  handlerRegistry,
  {
    shouldSkipEvent = () => false,
  } = {},
) {
  if (!handlerRegistry) {
    throw new TypeError("GW2 resolver event loop requires a handler registry.");
  }
  const queue = ctx.queue;
  const hp = targetHealth(ctx);
  sortQueuedEvents(queue);

  while (queue.length > 0) {
    const event = takeNextEvent(queue);
    if (event.at > ctx.horizon + EPSILON) break;
    if (ctx.deathTime != null && event.at > ctx.deathTime) break;
    if (shouldSkipEvent(ctx, event)) continue;
    if (
      ctx.combatStartTime != null
      && event.at < ctx.combatStartTime
      && (
        event.type === "damage"
        || event.type === "condition"
        || event.type === "condition_tick"
      )
    ) continue;

    if (handlerRegistry.has(event.type)) {
      handlerRegistry.dispatch(event, ctx);
    } else if (String(event.type).includes(".")) {
      throw new Error(
        `No event handler registered for required type: ${event.type}`,
      );
    }

    if (
      ctx.deathTime == null
      && ctx.totals.strike + ctx.totals.condition >= hp
    ) {
      ctx.deathTime = event.at;
    }
  }
}
