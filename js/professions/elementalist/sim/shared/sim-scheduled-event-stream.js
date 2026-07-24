// Explicit schedule->resolve boundary object. Carries scheduled events plus
// the named resolver handoff that seeds runtime state before queue draining.
import { disableSchedulerLookaheadIntents } from '../scheduler/sim-scheduler-intent-state.js';
import { assertQueuedEvent } from './sim-events.js';
import {
    buildResolverHandoff,
    bindResolverHandoffToRunState,
    applyResolverPostResolveState,
    isResolverHandoff,
} from './sim-resolver-handoff-model.js';

export const SCHEDULED_EVENT_STREAM_KIND = 'scheduled_event_stream';
export const SCHEDULED_EVENT_STREAM_VERSION = 2;

export function buildScheduledEventStream({
    events,
    rotationEndTime,
    resolverHandoff = null,
    source = 'rotation_scheduler',
    metadata = {},
}) {
    return {
        kind: SCHEDULED_EVENT_STREAM_KIND,
        version: SCHEDULED_EVENT_STREAM_VERSION,
        source,
        rotationEndTime,
        events,
        resolverHandoff,
        metadata,
    };
}

export function createScheduledEventStreamFromState(S, rotationEndTime, options = {}) {
    return buildScheduledEventStream({
        events: S.eq,
        rotationEndTime,
        resolverHandoff: buildResolverHandoff(options.schedulerState || S),
        source: options.source || 'rotation_scheduler',
        metadata: options.metadata || {},
    });
}

export function isScheduledEventStream(stream) {
    return !!stream
        && stream.kind === SCHEDULED_EVENT_STREAM_KIND
        && stream.version === SCHEDULED_EVENT_STREAM_VERSION
        && Array.isArray(stream.events)
        && isResolverHandoff(stream.resolverHandoff)
        && typeof stream.rotationEndTime === 'number';
}

export function assertScheduledEventStream(stream) {
    if (!isScheduledEventStream(stream)) {
        throw new Error('Invalid scheduled event stream: expected kind/version/events/resolverHandoff/rotationEndTime envelope');
    }
    if (!Number.isFinite(stream.rotationEndTime)) {
        throw new Error('Invalid scheduled event stream: rotationEndTime must be finite');
    }
    for (let i = 0; i < stream.events.length; i++) {
        assertQueuedEvent(stream.events[i], `scheduled stream event #${i}`);
    }
    return stream;
}

export function getScheduledStreamEvents(stream) {
    return assertScheduledEventStream(stream).events;
}

export function getScheduledStreamRotationEnd(stream) {
    return assertScheduledEventStream(stream).rotationEndTime;
}

export function getScheduledStreamResolverHandoff(stream) {
    return assertScheduledEventStream(stream).resolverHandoff;
}

export function bindScheduledStreamToRunState(S, stream) {
    const events = getScheduledStreamEvents(stream);
    bindResolverHandoffToRunState(S, getScheduledStreamResolverHandoff(stream));
    disableSchedulerLookaheadIntents(S);
    return events;
}

export function applyScheduledStreamPostResolveState(S, stream) {
    applyResolverPostResolveState(S, getScheduledStreamResolverHandoff(stream));
    return S;
}

export function cloneScheduledEventStream(stream) {
    const validated = assertScheduledEventStream(stream);
    return structuredClone(validated);
}
