/**
 * Versioned scheduler-to-resolver handoff format. Builds the immutable,
 * validated event stream the scheduler emits and the resolver (and fixtures)
 * consume, and asserts an arbitrary value satisfies that contract before reuse.
 */
import { assertSimulationEvent, EVENT_SCHEMA_VERSION } from './events.js';
import { createEventStream } from '../../../../../kernel/events/stream.js';

import type { ScheduledEventStream, SimulationEvent } from '../types.js';

interface BuildScheduledEventStreamOptions {
  readonly events: readonly SimulationEvent[];
  readonly rotationEndTime: number;
  readonly resolutionEndTime?: number;
  readonly resolverHandoff?: Record<string, unknown>;
  readonly source?: string;
}

/**
 * Versioned handoff format between scheduler and resolver.
 */
export const SCHEDULED_EVENT_STREAM_KIND = 'gw2.simulation.events' as const;
export const SCHEDULED_EVENT_STREAM_VERSION = 1 as const;

/**
 * Builds the immutable stream consumed by resolver pipelines and tests.
 *
 * @param {{
 *   events: readonly SimulationEvent[],
 *   rotationEndTime: number,
 *   resolutionEndTime?: number,
 *   resolverHandoff?: Record<string, unknown>,
 *   source?: string
 * }} options
 * @returns {ScheduledEventStream}
 */
export function buildScheduledEventStream(options: BuildScheduledEventStreamOptions): ScheduledEventStream {
  const {
    events,
    rotationEndTime,
    resolutionEndTime = rotationEndTime,
    resolverHandoff = {},
    source = 'platform.engine.scheduler'
  } = options;
  if (!Array.isArray(events)) throw new TypeError('Scheduled stream requires events.');
  if (!Number.isFinite(rotationEndTime)) {
    throw new TypeError('Scheduled stream requires a finite rotation end.');
  }

  if (!Number.isFinite(resolutionEndTime) || resolutionEndTime < rotationEndTime) {
    throw new TypeError('Scheduled stream resolution end must be finite and not precede the rotation end.');
  }

  for (const event of events) assertSimulationEvent(event);
  const stream = createEventStream(SCHEDULED_EVENT_STREAM_KIND, SCHEDULED_EVENT_STREAM_VERSION, events);
  return Object.freeze({
    ...stream,
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    source,
    rotationEndTime,
    resolutionEndTime,
    resolverHandoff: Object.freeze({ ...resolverHandoff })
  });
}

/**
 * Validates a scheduler output stream before resolution or fixture reuse.
 *
 * @param {unknown} stream
 * @returns {ScheduledEventStream}
 */
export function assertScheduledEventStream(stream: unknown): ScheduledEventStream {
  const candidate = stream as Partial<ScheduledEventStream> | null | undefined;
  if (
    !candidate ||
    candidate.kind !== SCHEDULED_EVENT_STREAM_KIND ||
    candidate.version !== SCHEDULED_EVENT_STREAM_VERSION ||
    candidate.eventSchemaVersion !== EVENT_SCHEMA_VERSION ||
    !Array.isArray(candidate.events) ||
    !Number.isFinite(candidate.rotationEndTime) ||
    (candidate.resolutionEndTime != null &&
      (!Number.isFinite(candidate.resolutionEndTime) ||
        candidate.resolutionEndTime < Number(candidate.rotationEndTime))) ||
    typeof candidate.source !== 'string' ||
    !candidate.source ||
    !candidate.resolverHandoff ||
    typeof candidate.resolverHandoff !== 'object' ||
    Array.isArray(candidate.resolverHandoff)
  ) {
    throw new Error('Invalid scheduled event stream.');
  }

  for (const event of candidate.events) assertSimulationEvent(event);
  return candidate as ScheduledEventStream;
}
