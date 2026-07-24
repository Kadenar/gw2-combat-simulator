import { sortQueuedEvents, takeNextEvent } from "../shared/sim-event-queue.js";
import {
  handleBlindEvent,
  handleConditionEvent,
  handleConditionTickEvent,
  handleControlEvent,
  handleDamageEvent,
  handlePeithaEvent,
  handleWeaponSetEvent,
} from "./sim-event-handlers.js";

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
 * @param {Object} ctx - Resolver context with scheduler.cloneDeaths map
 * @param {Object} event - Event with optional cloneId
 * @returns {boolean} True if event should be skipped (clone dead)
 */
function destroyedCloneEvent(ctx, event) {
  if (!event.cloneId) return false;
  const destroyedAt = ctx.scheduler.cloneDeaths.get(event.cloneId) ?? Infinity;
  return destroyedAt <= event.at + 0.0001;
}

/**
 * Main resolver loop: processes all scheduled events in order.
 * Filters: post-horizon, post-death, pre-combat-start, dead-clone events.
 * Dispatches to handlers (damage, condition, control, blind, peitha, weapon_set).
 * Tracks death time when total damage + condition ≥ target health.
 * @param {Object} ctx - Resolver context with queue, config, scheduler, totals, horizon, deathTime
 */
export function drainQueuedEvents(ctx) {
  const queue = ctx.queue;
  const hp = targetHealth(ctx);
  sortQueuedEvents(queue);

  while (queue.length > 0) {
    const event = takeNextEvent(queue);
    if (event.at > ctx.horizon + 0.0001) break;
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

    switch (event.type) {
      case "damage":
        handleDamageEvent(ctx, event);
        break;
      case "condition":
        handleConditionEvent(ctx, event);
        break;
      case "condition_tick":
        handleConditionTickEvent(ctx, event);
        break;
      case "control":
        handleControlEvent(ctx, event);
        break;
      case "blind":
        handleBlindEvent(ctx, event);
        break;
      case "peitha":
        handlePeithaEvent(ctx, event);
        break;
      case "weapon_set":
        handleWeaponSetEvent(ctx, event);
        break;
      default:
        break;
    }

    if (
      ctx.deathTime == null
      && ctx.totals.strike + ctx.totals.condition >= hp
    ) {
      ctx.deathTime = event.at;
    }
  }
}
