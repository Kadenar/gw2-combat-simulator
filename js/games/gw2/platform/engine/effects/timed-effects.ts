import { canonicalTime } from '#kernel/core/clock.js';
/** Queue port shared by scheduler tasks and resolver occurrences; phase-specific dispatch stays with the caller. */
export interface TimedEffectTaskAccess {
  schedule(task: {
    type: string;
    at: number;
    priority?: number;
    ownerId: string | number | null;
    payload: object;
  }): string;
  cancel(id: string): void;
}

interface TimedEffectContext {
  readonly state: object;
  readonly tasks: TimedEffectTaskAccess;
}

/** Queued work identifies an occurrence; callbacks and mutable progress stay in the registered definition. */
export interface TimedEffectOccurrence<TCaptured extends object> {
  readonly instanceId: number;
  readonly occurrence: number;
  readonly captured: TCaptured;
}

type Timing = { readonly times: readonly number[] } | { readonly at: number; readonly count?: number };

interface Instance<TCaptured extends object> {
  readonly id: number;
  readonly captured: TCaptured;
  readonly ownerId: string | number | null;
  readonly timing: Timing;
  readonly key?: string;
  occurrence: number;
  readonly tasks: Map<number, string>;
  nextAt: number;
}

/**
 * Runs finite or recurring effect sequences on the existing task queue. Early consumption invalidates the old occurrence before
 * executing it, and repeats restart from the actual consumption time. Each scheduler owns independent instance state.
 */
export function timedEffect<TContext extends TimedEffectContext, TCaptured extends object>(definition: {
  readonly id: string;
  readonly priority?: number;
  readonly interval?: (context: TContext) => number;
  readonly nextAt?: (context: TContext, at: number, captured: TCaptured) => number | null;
  readonly effectsAt: (context: TContext, at: number, captured: TCaptured, occurrence: number) => void | false;
}) {
  if (!definition.id.trim()) throw new TypeError('Timed effects require an id.');
  const runtimes = new WeakMap<object, { sequence: number; instances: Map<number, Instance<TCaptured>> }>();
  function runtime(context: TContext) {
    let value = runtimes.get(context.state);
    if (!value) {
      value = { sequence: 0, instances: new Map() };
      runtimes.set(context.state, value);
    }

    return value;
  }

  function timestamp(at: number): number {
    if (!Number.isFinite(at)) throw new TypeError('Timed effect timestamps must be finite.');
    return canonicalTime(at);
  }

  function schedule(
    context: TContext,
    instance: Instance<TCaptured>,
    at: number,
    occurrence = instance.occurrence
  ): void {
    const taskId = context.tasks.schedule({
      type: definition.id,
      at: timestamp(at),
      priority: definition.priority,
      ownerId: instance.ownerId,
      payload: { instanceId: instance.id, occurrence, captured: instance.captured }
    });
    instance.tasks.set(occurrence, taskId);
  }

  function cancel(context: TContext, instanceId: number): void {
    const instances = runtime(context).instances;
    const instance = instances.get(instanceId);
    if (instance) for (const taskId of instance.tasks.values()) context.tasks.cancel(taskId);
    instances.delete(instanceId);
  }

  function consume(context: TContext, instanceId: number, at: number): void {
    const instances = runtime(context).instances;
    const instance = instances.get(instanceId);
    if (!instance) return;
    at = timestamp(at);
    const taskId = instance.tasks.get(instance.occurrence);
    if (taskId != null) context.tasks.cancel(taskId);
    instance.tasks.delete(instance.occurrence);
    const occurrence = instance.occurrence++;
    const count = 'times' in instance.timing ? instance.timing.times.length : (instance.timing.count ?? Infinity);
    if (instance.occurrence >= count) instances.delete(instanceId);
    if (definition.effectsAt(context, at, instance.captured, occurrence) === false) {
      cancel(context, instanceId);
      return;
    }

    // A callback may cancel or replace this instance; never resurrect it afterward.
    if (!instances.has(instanceId)) return;
    if ('times' in instance.timing) {
      instance.nextAt = instance.timing.times[instance.occurrence];
    } else {
      const nextAt = definition.nextAt
        ? definition.nextAt(context, at, instance.captured)
        : at + Number(definition.interval?.(context));
      if (nextAt === null) {
        cancel(context, instanceId);
        return;
      }

      if (!Number.isFinite(nextAt) || canonicalTime(nextAt) <= at) {
        throw new TypeError('Timed effect intervals must be finite and positive.');
      }

      instance.nextAt = timestamp(nextAt);
      schedule(context, instance, instance.nextAt);
    }
  }

  const handleTask = (
    context: TContext,
    task: { readonly at: number; readonly payload?: TimedEffectOccurrence<TCaptured> | null }
  ): void => {
    const payload = task.payload;
    if (!payload) return;
    const instance = runtime(context).instances.get(payload.instanceId);
    if (!instance || instance.occurrence !== payload.occurrence) return;
    // The queue has already removed this task; only early consumption needs to cancel pending work.
    instance.tasks.delete(payload.occurrence);
    consume(context, instance.id, task.at);
  };

  return Object.freeze({
    taskHandlers: Object.freeze({ [definition.id]: handleTask }),
    start(
      context: TContext,
      options: Timing & { readonly captured: TCaptured; readonly ownerId?: string | number; readonly key?: string }
    ) {
      const timing: Timing =
        'times' in options
          ? { times: options.times.map(timestamp) }
          : { at: timestamp(options.at), count: options.count };
      if ('times' in timing) {
        if (!timing.times.length) return null;
        if (timing.times.some((at, index) => index > 0 && at < timing.times[index - 1])) {
          throw new RangeError('Timed effect occurrences must be chronological.');
        }
      } else if (timing.count != null && (!Number.isSafeInteger(timing.count) || timing.count < 1)) {
        throw new RangeError('Timed effect counts must be positive integers.');
      }

      if (!('times' in timing) && timing.count !== 1 && !definition.nextAt) {
        const interval = definition.interval?.(context);
        if (interval == null || !Number.isFinite(interval) || canonicalTime(interval) <= 0) {
          throw new TypeError('Timed effect intervals must be finite and positive.');
        }
      }

      const captured = structuredClone(options.captured);
      const state = runtime(context);
      // Keyed starts replace a lifetime, invalidating all work from its previous generation.
      if (options.key != null) {
        for (const instance of state.instances.values()) if (instance.key === options.key) cancel(context, instance.id);
      }

      const instance: Instance<TCaptured> = {
        id: ++state.sequence,
        captured,
        ownerId: options.ownerId ?? null,
        timing,
        key: options.key,
        occurrence: 0,
        tasks: new Map(),
        nextAt: 'times' in timing ? timing.times[0] : timing.at
      };
      if ('times' in timing) {
        // Prequeue explicit occurrences to preserve insertion order against other same-time work.
        timing.times.forEach((at, occurrence) => schedule(context, instance, at, occurrence));
      } else {
        schedule(context, instance, timing.at);
      }

      state.instances.set(instance.id, instance);
      return instance.id;
    },
    consume,
    consumeAll(context: TContext, at: number): void {
      for (const id of [...runtime(context).instances.keys()]) consume(context, id, at);
    },
    cancel,
    cancelKey(context: TContext, key: string): void {
      for (const instance of runtime(context).instances.values())
        if (instance.key === key) cancel(context, instance.id);
    },
    cancelOwner(context: TContext, ownerId: string): void {
      for (const instance of runtime(context).instances.values())
        if (instance.ownerId === ownerId) cancel(context, instance.id);
    },
    nextAt(context: TContext, key?: string): number {
      return Math.min(
        Infinity,
        ...[...runtime(context).instances.values()]
          .filter((instance) => key == null || instance.key === key)
          .map((instance) => instance.nextAt)
      );
    }
  });
}
