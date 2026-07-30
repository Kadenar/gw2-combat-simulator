/**
 * Stable event queue helpers used by both scheduling and resolution. Events are
 * ordered by timestamp, then explicit priority, then insertion order.
 */
export { EPSILON } from "./clock.js";

function explicitCausalOrder(event) {
  const order = Number(event?.causalOrder ?? event?.__order);
  return Number.isFinite(order) ? order : null;
}

function compareHeapEntries(left, right) {
  const eventOrder = compareQueuedEvents(left.event, right.event);
  if (eventOrder) return eventOrder;
  if (
    left.causalOrder != null
    && right.causalOrder != null
    && left.causalOrder !== right.causalOrder
  ) {
    return left.causalOrder - right.causalOrder;
  }
  return left.sequence - right.sequence;
}

/**
 * Sort comparator for queued events.
 */
export function compareQueuedEvents(left, right) {
  const time =
    Number(left.at ?? left.time ?? 0) - Number(right.at ?? right.time ?? 0);
  if (time) return time;
  const priority = Number(left.priority || 0) - Number(right.priority || 0);
  if (priority) return priority;
  const leftOrder = explicitCausalOrder(left);
  const rightOrder = explicitCausalOrder(right);
  return leftOrder != null && rightOrder != null
    ? leftOrder - rightOrder
    : 0;
}

/**
 * Stable min-heap for resolver event queues. Equal events retain insertion
 * order independently of any causal metadata already present on the event.
 * Resolver-created events inherit the causal order of the event currently
 * being handled, keeping derived effects adjacent to their cause without
 * leaking ordering state between simulations.
 */
export class StableEventQueue {
  constructor(events = []) {
    this.heap = [...events].map((event, sequence) => ({
      event,
      causalOrder: explicitCausalOrder(event),
      sequence,
    }));
    this.nextSequence = this.heap.length;
    this.currentCausalOrder = null;
    for (
      let index = Math.floor(this.heap.length / 2) - 1;
      index >= 0;
      index -= 1
    ) {
      this.siftDown(index);
    }
  }

  get length() {
    return this.heap.length;
  }

  enqueue(event) {
    const entry = {
      event,
      causalOrder:
        explicitCausalOrder(event) ?? this.currentCausalOrder,
      sequence: this.nextSequence,
    };
    this.nextSequence += 1;
    this.heap.push(entry);
    let index = this.heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareHeapEntries(this.heap[index], this.heap[parent]) >= 0) break;
      [this.heap[index], this.heap[parent]] =
        [this.heap[parent], this.heap[index]];
      index = parent;
    }
    return event;
  }

  dequeue() {
    if (this.heap.length === 0) return undefined;
    const first = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    this.currentCausalOrder = first.causalOrder;
    return first.event;
  }

  siftDown(start) {
    let index = start;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (
        left < this.heap.length
        && compareHeapEntries(this.heap[left], this.heap[smallest]) < 0
      ) {
        smallest = left;
      }
      if (
        right < this.heap.length
        && compareHeapEntries(this.heap[right], this.heap[smallest]) < 0
      ) {
        smallest = right;
      }
      if (smallest === index) return;
      [this.heap[index], this.heap[smallest]] =
        [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

export function createEventQueue(events = []) {
  return events instanceof StableEventQueue
    ? events
    : new StableEventQueue(events);
}

/**
 * Inserts an event while preserving queue order without a full re-sort.
 */
export function enqueueOrdered(queue, event) {
  if (queue instanceof StableEventQueue) return queue.enqueue(event);
  queue.push(event);
  let index = queue.length - 1;
  while (index > 0 && compareQueuedEvents(queue[index], queue[index - 1]) < 0) {
    [queue[index], queue[index - 1]] = [queue[index - 1], queue[index]];
    index -= 1;
  }
  return event;
}

/**
 * Re-sorts an existing queue in-place after bulk insertion or mutation.
 */
export function sortQueuedEvents(queue) {
  if (queue instanceof StableEventQueue) return queue;
  return queue.sort(compareQueuedEvents);
}

/**
 * Removes and returns the next event to process.
 */
export function takeNextEvent(queue) {
  return queue instanceof StableEventQueue
    ? queue.dequeue()
    : queue.shift();
}
