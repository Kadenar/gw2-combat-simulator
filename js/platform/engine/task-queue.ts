import { ACTION_SAFETY_LIMIT, EPSILON } from './clock.js';
import { insertSorted } from './collections.js';
import type { ScheduledTask, ScheduledTaskHandler, ScheduledTaskInput, TaskQueue } from './types.js';

function cloneSerializable<T>(value: T, label: string): T {
  try {
    return structuredClone(value);
  } catch {
    throw new TypeError(`${label} must contain only serializable data.`);
  }
}

/**
 * Creates the scheduler's private state-work queue. Tasks are ordered by
 * timestamp, priority, and insertion order and never enter the resolver stream.
 *
 * @template TContext
 * @template TPayload
 * @param {{
 *   handlers?: Readonly<Record<string, ScheduledTaskHandler<TContext, TPayload>>>,
 *   epsilon?: number,
 *   safetyLimit?: number
 * }} [options]
 * @returns {TaskQueue<TContext, TPayload>}
 */
export function createTaskQueue<TContext, TPayload>({
  handlers = {},
  epsilon = EPSILON,
  safetyLimit = ACTION_SAFETY_LIMIT
}: {
  readonly handlers?: Readonly<Record<string, ScheduledTaskHandler<TContext, TPayload>>>;
  readonly epsilon?: number;
  readonly safetyLimit?: number;
} = {}): Readonly<TaskQueue<TContext, TPayload>> {
  const registered = new Map<string, ScheduledTaskHandler<TContext, TPayload>>(Object.entries(handlers));
  const queue: ScheduledTask<TPayload>[] = [];
  const cancelledIds = new Set<string>();
  let sequence = 0;
  let processed = 0;

  const compareTasks = (left: ScheduledTask<TPayload>, right: ScheduledTask<TPayload>): number =>
    left.at - right.at || left.priority - right.priority || left.order - right.order;

  const schedule = (input: ScheduledTaskInput<TPayload>): string => {
    const { id, type, at, priority = 0, ownerId = null, payload = null, required = true } = input;
    const normalizedAt = Number(at);
    if (!Number.isFinite(normalizedAt)) {
      throw new TypeError('Scheduled task timestamps must be finite.');
    }

    const normalizedType = String(type || '');
    if (!normalizedType) throw new TypeError('Scheduled tasks require a type.');
    if (required && !registered.has(normalizedType)) {
      throw new TypeError(`No scheduled task handler is registered for "${normalizedType}".`);
    }

    const clonedPayload = cloneSerializable(payload, `Scheduled task "${normalizedType}" payload`);
    const task: ScheduledTask<TPayload> = Object.freeze({
      id: String(id || `task:${sequence + 1}`),
      type: normalizedType,
      at: normalizedAt,
      priority: Number(priority || 0),
      ownerId: ownerId == null ? null : String(ownerId),
      payload: clonedPayload,
      order: sequence++
    });
    insertSorted(queue, task, compareTasks);
    return task.id;
  };

  const cancel = (id: string | number): void => {
    cancelledIds.add(String(id));
  };

  const cancelOwner = (ownerId: string | number): void => {
    const normalizedOwner = String(ownerId);
    for (const task of queue) {
      if (task.ownerId === normalizedOwner) cancelledIds.add(task.id);
    }
  };

  const isCancelled = (task: ScheduledTask<TPayload>): boolean => cancelledIds.has(task.id);

  const discardCancelledHead = (): void => {
    while (queue.length && isCancelled(queue[0])) queue.shift();
  };

  // Availability rules can target one queued mechanic without being delayed by unrelated work.
  const nextAt = (type?: string): number => {
    discardCancelledHead();
    if (type == null) return queue[0]?.at ?? Infinity;
    return queue.find((task) => task.type === type && !isCancelled(task))?.at ?? Infinity;
  };

  const drainThrough = (target: number, context: TContext): void => {
    const normalizedTarget = Number(target);
    if (!Number.isFinite(normalizedTarget)) {
      throw new TypeError('Task drain target must be finite.');
    }

    let lastAt: number | null = null;
    let sameTimeCount = 0;
    while (nextAt() <= normalizedTarget + epsilon) {
      const task = queue.shift();
      if (!task) continue;
      if (isCancelled(task)) continue;
      if (lastAt != null && Math.abs(task.at - lastAt) <= epsilon) {
        sameTimeCount += 1;
      } else {
        lastAt = task.at;
        sameTimeCount = 1;
      }

      if (sameTimeCount > safetyLimit) {
        throw new Error(`Zero-time scheduled task loop detected at ${task.at.toFixed(3)}.`);
      }

      if (++processed > safetyLimit) {
        throw new Error(`Scheduled task safety limit (${safetyLimit}) exceeded.`);
      }

      const handler = registered.get(task.type);
      if (typeof handler === 'function') handler(context, task);
    }
  };

  return Object.freeze({
    schedule,
    cancel,
    cancelOwner,
    nextAt,
    drainThrough,
    has: (id: string | number) => queue.some((task) => task.id === String(id) && !isCancelled(task))
  });
}
