// Versioned event stream passed from scheduler to resolver
// Versioned format ensures compatibility if schema changes in future

export const SCHEDULED_EVENT_STREAM_KIND = "gw2_scheduled_event_stream";
export const SCHEDULED_EVENT_STREAM_VERSION = 1;

// Creates versioned event stream with validation
export function buildScheduledEventStream({
  events,
  rotationEndTime,
  resolverHandoff = {},
  source = "gw2_rotation_scheduler",
}) {
  if (!Array.isArray(events)) {
    throw new Error("Scheduled stream requires an event array.");
  }
  if (!Number.isFinite(rotationEndTime)) {
    throw new Error("Scheduled stream requires a finite rotation end.");
  }
  const normalizedEvents = events.map(event => ({
    ...event,
    source: event.source || "System",
    sourceId:
      event.sourceId
      ?? event.skillId
      ?? event.skillName
      ?? event.name
      ?? event.type,
  }));
  return {
    kind: SCHEDULED_EVENT_STREAM_KIND,
    version: SCHEDULED_EVENT_STREAM_VERSION,
    source,
    rotationEndTime,
    events: normalizedEvents,
    resolverHandoff,
  };
}

export function assertScheduledEventStream(stream) {
  if (
    !stream
    || stream.kind !== SCHEDULED_EVENT_STREAM_KIND
    || stream.version !== SCHEDULED_EVENT_STREAM_VERSION
    || !Array.isArray(stream.events)
    || !Number.isFinite(stream.rotationEndTime)
  ) {
    throw new Error("Invalid scheduled event stream.");
  }
  return stream;
}
