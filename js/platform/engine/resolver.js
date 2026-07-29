import { assertScheduledEventStream } from "./scheduled-event-stream.js";
import { sortQueuedEvents } from "./event-queue.js";

// Minimal resolver implementation for event streams whose behavior is fully
// provided by registered handlers. Shared GW2 resolution layers build on this
// state shape rather than reimplementing queue management.

/**
 * Creates the base mutable state consumed by stream resolution.
 */
export function createResolverState({ profession, config = {}, stream } = {}) {
  return {
    time: 0,
    config,
    profession: structuredClone(
      typeof profession.createResolverState === "function"
        ? profession.createResolverState(config)
        : profession.createProfessionState(config),
    ),
    totals: { strike: 0, condition: 0 },
    breakdown: new Map(),
    conditions: new Map(),
    boons: new Map(),
    resolvedEvents: [],
    procs: [],
    warnings: [],
  };
}

/**
 * Accumulates per-skill damage totals in the canonical breakdown map.
 */
export function addBreakdown(state, id, name, type, damage, hits = 0) {
  const current = state.breakdown.get(id) || {
    id,
    name,
    damage: 0,
    strikeDamage: 0,
    conditionDamage: 0,
    hits: 0,
  };
  current.damage += damage;
  current[type] += damage;
  current.hits += hits;
  state.breakdown.set(id, current);
}

/**
 * Runs a scheduled event stream through the supplied handler registry and
 * returns canonical damage totals plus resolver-side state snapshots.
 */
export function resolveScheduledStream({
  stream,
  profession,
  handlerRegistry,
  config = {},
} = {}) {
  const scheduled = assertScheduledEventStream(stream);
  if (!handlerRegistry)
    throw new TypeError("Resolver requires a handler registry.");
  handlerRegistry.require(scheduled.events.map((event) => event.type));
  const state = createResolverState({ profession, config, stream: scheduled });
  const queue = scheduled.events.map((event) => ({ ...event }));
  sortQueuedEvents(queue);
  const context = {
    profession,
    config,
    state,
    queue,
    stream: scheduled,
    addBreakdown: (...args) => addBreakdown(state, ...args),
  };
  for (const event of queue) {
    state.time = event.at;
    handlerRegistry.dispatch(event, context);
    state.resolvedEvents.push(event);
  }
  const duration = Math.max(0.0001, scheduled.rotationEndTime);
  const totalDamage = state.totals.strike + state.totals.condition;
  return {
    duration,
    totalDamage,
    dps: totalDamage / duration,
    strikeDamage: state.totals.strike,
    conditionDamage: state.totals.condition,
    breakdown: [...state.breakdown.values()].sort(
      (left, right) => right.damage - left.damage,
    ),
    events: scheduled.events,
    resolvedEvents: state.resolvedEvents,
    profession: state.profession,
    warnings: state.warnings,
  };
}
