const DEFAULT_LIMIT = 100_000;

function assertSerializable(value, label) {
  try {
    structuredClone(value);
  } catch {
    throw new TypeError(`${label} must contain only serializable data.`);
  }
}

/**
 * Creates the scheduler's private state-work queue. Tasks are ordered by
 * timestamp, priority, and insertion order and never enter the resolver stream.
 */
export function createTaskQueue({
  handlers = {},
  epsilon = 0.0001,
  safetyLimit = DEFAULT_LIMIT,
} = {}) {
  const registered = new Map(Object.entries(handlers));
  const queue = [];
  const cancelledIds = new Set();
  let sequence = 0;
  let processed = 0;

  const compareTasks = (left, right) =>
    left.at - right.at ||
    left.priority - right.priority ||
    left.order - right.order;
  const insertTask = (task) => {
    let low = 0;
    let high = queue.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (compareTasks(queue[middle], task) <= 0) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    queue.splice(low, 0, task);
  };

  const schedule = ({
    id,
    type,
    at,
    priority = 0,
    ownerId = null,
    payload = null,
    required = true,
  } = {}) => {
    const normalizedAt = Number(at);
    if (!Number.isFinite(normalizedAt)) {
      throw new TypeError("Scheduled task timestamps must be finite.");
    }
    const normalizedType = String(type || "");
    if (!normalizedType) throw new TypeError("Scheduled tasks require a type.");
    if (required && !registered.has(normalizedType)) {
      throw new TypeError(
        `No scheduled task handler is registered for "${normalizedType}".`,
      );
    }
    assertSerializable(payload, `Scheduled task "${normalizedType}" payload`);
    const task = Object.freeze({
      id: String(id || `task:${sequence + 1}`),
      type: normalizedType,
      at: normalizedAt,
      priority: Number(priority || 0),
      ownerId: ownerId == null ? null : String(ownerId),
      payload: structuredClone(payload),
      order: sequence++,
    });
    insertTask(task);
    return task.id;
  };

  const cancel = (id) => {
    cancelledIds.add(String(id));
  };

  const cancelOwner = (ownerId) => {
    const normalizedOwner = String(ownerId);
    for (const task of queue) {
      if (task.ownerId === normalizedOwner) cancelledIds.add(task.id);
    }
  };

  const isCancelled = (task) => cancelledIds.has(task.id);

  const discardCancelledHead = () => {
    while (queue.length && isCancelled(queue[0])) queue.shift();
  };

  const nextAt = () => {
    discardCancelledHead();
    return queue[0]?.at ?? Infinity;
  };

  const drainThrough = (target, context) => {
    const normalizedTarget = Number(target);
    if (!Number.isFinite(normalizedTarget)) {
      throw new TypeError("Task drain target must be finite.");
    }
    let lastAt = null;
    let sameTimeCount = 0;
    while (nextAt() <= normalizedTarget + epsilon) {
      const task = queue.shift();
      if (isCancelled(task)) continue;
      if (lastAt != null && Math.abs(task.at - lastAt) <= epsilon) {
        sameTimeCount += 1;
      } else {
        lastAt = task.at;
        sameTimeCount = 1;
      }
      if (sameTimeCount > safetyLimit) {
        throw new Error(
          `Zero-time scheduled task loop detected at ${task.at.toFixed(3)}.`,
        );
      }
      if (++processed > safetyLimit) {
        throw new Error(
          `Scheduled task safety limit (${safetyLimit}) exceeded.`,
        );
      }
      const handler = registered.get(task.type);
      if (typeof handler === "function") handler(context, task);
    }
  };

  return Object.freeze({
    schedule,
    cancel,
    cancelOwner,
    nextAt,
    drainThrough,
    has: (id) =>
      queue.some((task) => task.id === String(id) && !isCancelled(task)),
  });
}
