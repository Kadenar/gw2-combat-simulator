import { normalizeBoonDuration } from '#gw2/platform/combat/boons.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { assertSimulationEvent, EVENT_SCHEMA_VERSION } from '#gw2/platform/engine/events/events.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';
import { canonicalEvent } from '#kernel/events/queue.js';
import { createEventStream } from '#kernel/events/stream.js';
/**
 * Versioned scheduler-to-resolver handoff format. Builds the immutable,
 * validated event stream the scheduler emits and the resolver (and fixtures)
 * consume, and asserts an arbitrary value satisfies that contract before reuse.
 */

interface BuildScheduledEventStreamOptions {
  readonly events: readonly SimulationEvent[];
  readonly rotationEndTime: number;
  readonly resolutionEndTime?: number;
  readonly resolverHandoff?: Gw2ResolverHandoff;
  readonly source?: string;
}

/**
 * Versioned handoff format between scheduler and resolver.
 */
export const SCHEDULED_EVENT_STREAM_KIND = 'gw2.simulation.events' as const;
export const SCHEDULED_EVENT_STREAM_VERSION = 1 as const;

/**
 * Builds the immutable stream consumed by resolver pipelines and tests.
 */
export function buildScheduledEventStream(options: BuildScheduledEventStreamOptions): ScheduledEventStream {
  const {
    events,
    rotationEndTime,
    resolutionEndTime = rotationEndTime,
    resolverHandoff = {},
    source = 'platform.engine.scheduler'
  } = options;
  // Use the consumer's rules before copying handoff metadata so malformed input cannot become a valid-looking object.
  const stream = assertScheduledEventStream({
    ...createEventStream(SCHEDULED_EVENT_STREAM_KIND, SCHEDULED_EVENT_STREAM_VERSION, events),
    eventSchemaVersion: EVENT_SCHEMA_VERSION,
    source,
    rotationEndTime,
    resolutionEndTime,
    resolverHandoff
  });
  return Object.freeze({
    ...stream,
    events: Object.freeze(stream.events.map((event) => normalizeBoonDuration(canonicalEvent(event)))),
    rotationEndTime: canonicalTime(rotationEndTime),
    resolutionEndTime: canonicalTime(resolutionEndTime),
    resolverHandoff: Object.freeze({
      ...stream.resolverHandoff,
      ...(stream.resolverHandoff.combatStartTime == null
        ? {}
        : { combatStartTime: canonicalTime(stream.resolverHandoff.combatStartTime) })
    })
  });
}

/**
 * Validates a scheduler output stream before resolution or fixture reuse.
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
    Number(candidate.rotationEndTime) < 0 ||
    (candidate.resolutionEndTime !== undefined &&
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
  timeKey(Number(candidate.rotationEndTime));
  if (candidate.resolutionEndTime !== undefined) timeKey(candidate.resolutionEndTime);
  if (candidate.resolverHandoff.combatStartTime != null) timeKey(candidate.resolverHandoff.combatStartTime);
  return candidate as ScheduledEventStream;
}

/** Defines emitted events and recipient metadata shared by scheduling, resolution, and presentation. */

/** Carries encounter boundaries and diagnostics; profession state is reconstructed from chronological events. */
export interface Gw2ResolverHandoff {
  readonly warnings?: readonly string[];
  readonly hasExplicitCombatStart?: boolean;
  readonly combatStartTime?: number | null;
}

export interface ScheduledEventStream {
  readonly kind: 'gw2.simulation.events';
  readonly version: 1;
  readonly eventSchemaVersion: 1;
  readonly source: string;
  readonly rotationEndTime: number;
  readonly resolutionEndTime?: number;
  readonly events: readonly SimulationEvent[];
  readonly resolverHandoff: Gw2ResolverHandoff;
}
