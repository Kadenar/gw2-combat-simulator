// Resolver entry point: bind the scheduled stream onto runtime state,
// drain queued events, and return the post-resolution timing outputs.
import { createRuntimeContext } from './sim-runtime-context.js';
import { drainQueuedEvents } from './sim-resolver-events.js';
import {
    assertScheduledEventStream,
    applyScheduledStreamPostResolveState,
    bindScheduledStreamToRunState,
    getScheduledStreamRotationEnd,
} from '../shared/sim-scheduled-event-stream.js';

export function resolveScheduledStream(engine, S, scheduledStream, runtimeConfig, {
    stopAtTime,
    targetHP,
}) {
    if (!engine || typeof engine !== 'object') {
        throw new Error('resolveScheduledStream requires an engine object');
    }
    if (!S || typeof S !== 'object') {
        throw new Error('resolveScheduledStream requires a run state object');
    }
    if (!runtimeConfig || typeof runtimeConfig !== 'object') {
        throw new Error('resolveScheduledStream requires runtime config');
    }

    const validatedStream = assertScheduledEventStream(scheduledStream);
    const queue = bindScheduledStreamToRunState(S, validatedStream);
    const rotationEndTime = getScheduledStreamRotationEnd(validatedStream);
    const runtimeCtx = createRuntimeContext(engine, S, {
        ...runtimeConfig,
        eventQueue: queue,
    });
    const deathTime = drainQueuedEvents(runtimeCtx, queue, {
        rotationEndTime,
        stopAtTime,
        targetHP,
    });
    applyScheduledStreamPostResolveState(S, validatedStream);

    return {
        deathTime,
        rotationEndTime,
    };
}
