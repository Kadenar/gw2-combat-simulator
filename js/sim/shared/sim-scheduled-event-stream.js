// Event stream serialization for passing scheduler output to resolver
// Versioned format ensures compatibility if schema changes in future

export const SCHEDULED_EVENT_STREAM_KIND = "mesmer_scheduled_event_stream";
export const SCHEDULED_EVENT_STREAM_VERSION = 1;

// Creates versioned event stream with validation
export function buildScheduledEventStream({
  events,
  rotationEndTime,
  resolverHandoff = {},
  source = "mesmer_rotation_scheduler",
}) {
  if (!Array.isArray(events)) {
    throw new Error("Mesmer scheduled stream requires an event array.");
  }
  if (!Number.isFinite(rotationEndTime)) {
    throw new Error("Mesmer scheduled stream requires a finite rotation end.");
  }
  return {
    kind: SCHEDULED_EVENT_STREAM_KIND,
    version: SCHEDULED_EVENT_STREAM_VERSION,
    source,
    rotationEndTime,
    events,
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
    throw new Error("Invalid Mesmer scheduled event stream.");
  }
  return stream;
}
