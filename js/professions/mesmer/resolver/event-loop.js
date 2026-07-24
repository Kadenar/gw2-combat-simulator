import { sortQueuedEvents, takeNextEvent } from "../../../platform/engine/event-queue.js";
import { EPSILON } from "../../../platform/engine/clock.js";
import {
  handleBlindEvent,
  handleConditionEvent,
  handleConditionTickEvent,
  handleControlEvent,
  handleDamageEvent,
  handlePeithaEvent,
  handleWeaponSetEvent,
} from "./event-handlers.js";
import { HandlerRegistry } from "../../../platform/engine/handler-registry.js";

const IGNORED_EVENT_TYPES = [
  "action",
  "combat_start",
  "marker",
  "proc",
  "resource",
  "phantasm_summoned",
  "phantasm_resummoned",
  "phantasm_attack",
  "buff",
  "instrument",
  "weakness_vulnerability",
];

export function createResolverHandlerRegistry(additionalHandlers = {}) {
  const registry = new HandlerRegistry()
    .register("damage", handleDamageEvent)
    .register("condition", handleConditionEvent)
    .register("condition_tick", handleConditionTickEvent)
    .register("control", handleControlEvent)
    .register("blind", handleBlindEvent)
    .register("peitha", handlePeithaEvent)
    .register("weapon_set", handleWeaponSetEvent);
  for (const type of IGNORED_EVENT_TYPES) registry.register(type, () => {});
  registry.registerAll(additionalHandlers);
  return registry;
}

/**
 * Extracts target health from config. Defaults to Infinity if not set or ≤ 0.
 * @param {Object} ctx - Resolver context with config
 * @returns {number} Target health (HP threshold for death)
 */
function targetHealth(ctx) {
  const value = Number(
    ctx.config.target?.health
    ?? ctx.config.targetHP
    ?? 0,
  );
  return value > 0 ? value : Infinity;
}

/**
 * Checks if an event belongs to a clone that was destroyed before the event time.
 * @param {Object} ctx - Resolver context with cloneDeaths map
 * @param {Object} event - Event with optional cloneId
 * @returns {boolean} True if event should be skipped (clone dead)
 */
function destroyedCloneEvent(ctx, event) {
  if (!event.cloneId) return false;
  const destroyedAt = ctx.cloneDeaths.get(event.cloneId) ?? Infinity;
  return destroyedAt <= event.at + EPSILON;
}

/**
 * Main resolver loop: processes all scheduled events in order.
 * Filters: post-horizon, post-death, pre-combat-start, dead-clone events.
 * Dispatches to handlers (damage, condition, control, blind, peitha, weapon_set).
 * Tracks death time when total damage + condition ≥ target health.
 * @param {Object} ctx - Resolver context with queue, config, scheduler, totals, horizon, deathTime
 */
export function runEventLoop(ctx, handlerRegistry = createResolverHandlerRegistry()) {
  const queue = ctx.queue;
  const hp = targetHealth(ctx);
  sortQueuedEvents(queue);

  while (queue.length > 0) {
    const event = takeNextEvent(queue);
    if (event.at > ctx.horizon + EPSILON) break;
    if (ctx.deathTime != null && event.at > ctx.deathTime) break;
    if (destroyedCloneEvent(ctx, event)) continue;
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
      throw new Error(`No event handler registered for required type: ${event.type}`);
    }

    if (
      ctx.deathTime == null
      && ctx.totals.strike + ctx.totals.condition >= hp
    ) {
      ctx.deathTime = event.at;
    }
  }
}
