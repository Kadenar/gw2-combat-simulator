import { assertSimulationEvent, EVENT_SCHEMA_VERSION } from "./events.js";

/**
 * Versioned handoff format between scheduler and resolver.
 */
export const SCHEDULED_EVENT_STREAM_KIND = "gw2.simulation.events";
export const SCHEDULED_EVENT_STREAM_VERSION = 1;

/**
 * Builds the immutable stream consumed by resolver pipelines and tests.
 */
export function buildScheduledEventStream({
  events,
  rotationEndTime,
  resolverHandoff = {},
  source = "platform.engine.scheduler",
}) {
  if (!Array.isArray(events)) throw new TypeError("Scheduled stream requires events.");
  if (!Number.isFinite(rotationEndTime)) {
    throw new TypeError("Scheduled stream requires a finite rotation end.");
  }
  for (const event of events) assertSimulationEvent(event);
  return Object.freeze({
    kind: SCHEDULED_EVENT_STREAM_KIND,
    version: SCHEDULED_EVENT_STREAM_VERSION,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    source,
    rotationEndTime,
    events: Object.freeze([...events]),
    resolverHandoff: Object.freeze({ ...resolverHandoff }),
  });
}

/**
 * Validates a scheduler output stream before resolution or fixture reuse.
 */
export function assertScheduledEventStream(stream) {
  if (
    !stream
    || stream.kind !== SCHEDULED_EVENT_STREAM_KIND
    || stream.version !== SCHEDULED_EVENT_STREAM_VERSION
    || stream.eventSchemaVersion !== EVENT_SCHEMA_VERSION
    || !Array.isArray(stream.events)
    || !Number.isFinite(stream.rotationEndTime)
  ) {
    throw new Error("Invalid scheduled event stream.");
  }
  for (const event of stream.events) assertSimulationEvent(event);
  return stream;
}
