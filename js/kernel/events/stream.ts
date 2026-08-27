export interface EventStream<TEvent, TKind extends string = string, TVersion extends number = number> {
  readonly kind: TKind;
  readonly version: TVersion;
  readonly events: readonly TEvent[];
}

/** Creates an immutable stream whose identity and schema version are supplied by the owning game. */
export function createEventStream<TEvent, TKind extends string, TVersion extends number>(
  kind: TKind,
  version: TVersion,
  events: readonly TEvent[]
): EventStream<TEvent, TKind, TVersion> {
  if (!kind.trim()) throw new TypeError('Event stream kind must be a non-empty string.');
  if (!Number.isInteger(version) || version < 1)
    throw new TypeError('Event stream version must be a positive integer.');
  if (!Array.isArray(events)) throw new TypeError('Event stream events must be an array.');
  return Object.freeze({ kind, version, events: Object.freeze([...events]) });
}
