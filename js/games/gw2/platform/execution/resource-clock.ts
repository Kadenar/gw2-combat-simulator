import { timedEffect } from '#gw2/platform/execution/timed-effects.js';
import { resourceDepletionAt, type ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { SchedulerTaskAccess } from '#gw2/platform/execution/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** One generation-safe exit combines a resource's zero crossing and optional maximum lifetime. */
export function resourceDepletion<
  TContext extends { readonly state: object; readonly tasks: SchedulerTaskAccess }
>(definition: {
  readonly id: string;
  readonly priority?: number;
  readonly clock: (context: TContext) => ResourceClock;
  readonly endsAt?: (context: TContext) => number;
  readonly depleted: (context: TContext, at: number) => void;
}) {
  const deadline = (context: TContext) =>
    Math.min(resourceDepletionAt(definition.clock(context)), definition.endsAt?.(context) ?? Infinity);
  const lifetime = timedEffect({
    id: definition.id,
    priority: definition.priority,
    effectsAt(context: TContext, at: number) {
      // Gains or rate changes can postpone the old boundary; the shared instance owns its replacement.
      if (canonicalTime(deadline(context)) > canonicalTime(at)) refresh(context);
      else definition.depleted(context, at);
    }
  });
  function refresh(context: TContext): void {
    const at = deadline(context);
    if (Number.isFinite(at)) lifetime.start(context, { key: definition.id, times: [at], captured: {} });
    else lifetime.cancelKey(context, definition.id);
  }

  return Object.freeze({
    taskHandlers: lifetime.taskHandlers,
    refresh,
    stop: (context: TContext) => lifetime.cancelKey(context, definition.id)
  });
}
