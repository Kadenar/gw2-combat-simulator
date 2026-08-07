import { EPSILON } from "../../engine/clock.js";
import { sortQueuedEvents, takeNextEvent } from "../../engine/event-queue.js";
import { HandlerRegistry } from "../../engine/handler-registry.js";

import type {
  Gw2ResolverEvent,
  Gw2ResolverEventHandlers,
  Gw2ResolverHandlerRegistry,
  Gw2ResolverRuntime,
} from "../types.js";

interface CreateGw2ResolverHandlerRegistryOptions {
  readonly commonHandlers?: Gw2ResolverEventHandlers;
  readonly professionHandlers?: Gw2ResolverEventHandlers;
}

interface RunGw2ResolverEventLoopOptions {
  readonly shouldSkipEvent?: (
    context: Gw2ResolverRuntime,
    event: Gw2ResolverEvent,
  ) => boolean;
}

/**
 * @param {{
 *   commonHandlers?: Gw2ResolverEventHandlers,
 *   professionHandlers?: Gw2ResolverEventHandlers
 * }} [options]
 * @returns {Gw2ResolverHandlerRegistry}
 */
export function createGw2ResolverHandlerRegistry({
  commonHandlers = {},
  professionHandlers = {},
}: CreateGw2ResolverHandlerRegistryOptions = {}): Gw2ResolverHandlerRegistry {
  const registry = new HandlerRegistry<Gw2ResolverRuntime, Gw2ResolverEvent>();
  return registry.registerAll(commonHandlers).registerAll(professionHandlers);
}

function targetHealth(ctx: Gw2ResolverRuntime): number {
  const value = Number(ctx.config.target?.health ?? ctx.config.targetHP ?? 0);
  return value > 0 ? value : Infinity;
}

/**
 * Events suppressed before an explicit Combat Start: outgoing damage/condition
 * output plus target vulnerability, which scales that output. Bookkeeping
 * events still process so state stays consistent across the gate.
 */
function isCombatGatedEvent(event: Gw2ResolverEvent): boolean {
  return (
    event.type === "damage" ||
    event.type === "condition" ||
    event.type === "condition_tick" ||
    (event.type === "buff" && event.kind === "target-vulnerability")
  );
}

/**
 * Drains a GW2 resolver queue. Professions may filter their own actor events,
 * but time ordering, encounter bounds, combat start, target death, and handler
 * dispatch remain common.
 */
export function runGw2ResolverEventLoop(
  ctx: Gw2ResolverRuntime,
  handlerRegistry: Gw2ResolverHandlerRegistry,
  { shouldSkipEvent = () => false }: RunGw2ResolverEventLoopOptions = {},
): void {
  if (!handlerRegistry) {
    throw new TypeError("GW2 resolver event loop requires a handler registry.");
  }
  const queue = ctx.queue;
  const hp = targetHealth(ctx);
  sortQueuedEvents(queue);

  while (queue.length > 0) {
    const event = takeNextEvent(queue);
    if (!event) break;
    if (event.at > ctx.horizon + EPSILON) break;
    if (ctx.deathTime != null && event.at > ctx.deathTime) break;
    if (shouldSkipEvent(ctx, event)) continue;
    if (
      ctx.combatStartTime != null &&
      event.at < ctx.combatStartTime - EPSILON &&
      isCombatGatedEvent(event)
    )
      continue;

    if (handlerRegistry.has(event.type)) {
      handlerRegistry.dispatch(event, ctx);
    } else if (String(event.type).includes(".")) {
      throw new Error(
        `No event handler registered for required type: ${event.type}`,
      );
    }

    if (
      ctx.deathTime == null &&
      ctx.totals.strike + ctx.totals.condition >= hp
    ) {
      ctx.deathTime = event.at;
    }
  }
}
