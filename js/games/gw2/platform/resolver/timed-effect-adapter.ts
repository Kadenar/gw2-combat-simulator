import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import {
  timedEffect,
  type TimedEffectOccurrence,
  type TimedEffectTaskAccess
} from '#gw2/platform/engine/effects/timed-effects.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Connects the shared timed-effect implementation to the resolver queue and bounds recurrence by its horizon. */
export function resolverTimedEffect<TContext extends Gw2ResolverRuntime, TCaptured extends object>(definition: {
  readonly id: `${string}.${string}`;
  readonly priority?: number;
  readonly interval: (context: TContext) => number;
  readonly effectsAt: (context: TContext, at: number, captured: TCaptured) => void | false;
}) {
  function adapt(context: TContext) {
    const tasks: TimedEffectTaskAccess = {
      schedule(task) {
        context.queue.enqueue({
          type: definition.id,
          at: task.at,
          priority: task.priority,
          timedEffect: task.payload,
          source: 'Timed Effect',
          sourceId: definition.id,
          actorType: 'effect'
        });
        const occurrence = task.payload as TimedEffectOccurrence<TCaptured>;
        return `${definition.id}:${occurrence.instanceId}:${occurrence.occurrence}`;
      },
      // Resolver events cannot be removed; timedEffect rejects their retired instance/occurrence identities.
      cancel() {}
    };
    return { state: context.queue, tasks, resolver: context };
  }

  const sequence = timedEffect<ReturnType<typeof adapt>, TCaptured>({
    id: definition.id,
    priority: definition.priority,
    effectsAt: (context, at, captured) => definition.effectsAt(context.resolver, at, captured),
    nextAt(context, at) {
      const interval = definition.interval(context.resolver);
      const next = canonicalTime(at + interval);
      return interval > 0 &&
        next > at &&
        (context.resolver.horizon == null || next <= context.resolver.horizon + EPSILON)
        ? next
        : null;
    }
  });

  return Object.freeze({
    start(context: TContext, options: { at: number; key: string; captured: TCaptured }) {
      return sequence.start(adapt(context), options);
    },
    nextAt: (context: TContext, key?: string) => sequence.nextAt(adapt(context), key),
    eventHandlers: Object.freeze({
      [definition.id]: (context: TContext, event: Gw2ResolverEvent) => {
        const payload = event.timedEffect as TimedEffectOccurrence<TCaptured> | undefined;
        if (!payload) return;
        sequence.taskHandlers[definition.id](adapt(context), {
          at: event.at,
          payload
        });
      }
    })
  });
}
