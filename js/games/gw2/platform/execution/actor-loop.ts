import { canonicalTime } from '#kernel/core/clock.js';
import { timedEffect } from '#gw2/platform/engine/effects/timed-effects.js';
import type { SchedulerTaskAccess } from '#gw2/platform/execution/types.js';

interface ActorStart<TState extends object> {
  readonly key: string;
  readonly ownerId: string;
  readonly firstAt: number;
  readonly state: TState;
}

/** Serializes autonomous actions and command recovery using the same generation-safe lifetimes as timed effects. */
export function actorLoop<
  TContext extends { readonly state: object; readonly tasks: SchedulerTaskAccess },
  TState extends object
>(definition: {
  readonly id: string;
  readonly priority?: number;
  readonly readyAt?: (context: TContext, at: number, state: TState) => number;
  readonly step: (
    context: TContext,
    at: number,
    state: TState
  ) => { readonly at: number; readonly state: TState } | null;
}) {
  const actions = timedEffect({
    id: definition.id,
    priority: definition.priority,
    effectsAt(context: TContext, at: number, captured: { state: TState; nextAt: number | null }) {
      // Compare recovery on the queue clock so rounding cannot create a zero-time wait.
      const readyAt = canonicalTime(definition.readyAt?.(context, at, captured.state) ?? at);
      if (readyAt > at) {
        captured.nextAt = readyAt;
        return;
      }

      const next = definition.step(context, at, captured.state);
      captured.nextAt = next?.at ?? null;
      if (next) captured.state = next.state;
    },
    nextAt: (_context: TContext, _at: number, captured: { state: TState; nextAt: number | null }) => captured.nextAt
  });
  const starts = timedEffect({
    id: `${definition.id}.start`,
    priority: definition.priority,
    effectsAt(context: TContext, _at: number, captured: ActorStart<TState>) {
      replace(context, captured);
    }
  });
  const stops = timedEffect({
    id: `${definition.id}.stop`,
    priority: definition.priority,
    effectsAt(context: TContext, _at: number, captured: { readonly ownerId: string }) {
      // Stopping autonomous work leaves already-produced fields and projectiles in the event stream.
      actions.cancelOwner(context, captured.ownerId);
      starts.cancelOwner(context, captured.ownerId);
    }
  });

  // Immediate replacement is for already-committed actor transitions; future activations use the start task above.
  function replace(context: TContext, options: ActorStart<TState>): void {
    actions.start(context, {
      key: options.key,
      ownerId: options.ownerId,
      at: options.firstAt,
      captured: { state: options.state, nextAt: null }
    });
  }

  return Object.freeze({
    taskHandlers: Object.freeze({ ...actions.taskHandlers, ...starts.taskHandlers, ...stops.taskHandlers }),
    start(context: TContext, at: number, options: ActorStart<TState>): void {
      starts.start(context, { times: [at], ownerId: options.ownerId, captured: options });
    },
    stop(context: TContext, at: number, ownerId: string): void {
      stops.start(context, { times: [at], captured: { ownerId } });
    },
    replace,
    cancel: actions.cancelKey,
    nextAt: actions.nextAt
  });
}
