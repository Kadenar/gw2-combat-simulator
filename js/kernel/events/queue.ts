/**
 * Stable event queue helpers used by both scheduling and resolution. Events are
 * ordered by timestamp, priority, causal placement (untagged last), then stable
 * insertion order. Missing or nonfinite causal metadata shares the untagged tier.
 */
export { EPSILON } from '#kernel/core/clock.js';

export interface QueuedEvent {
  readonly at?: number;
  readonly time?: number;
  readonly priority?: number;
  readonly causalOrder?: number;
  readonly eventOrder?: number;
  readonly [field: string]: unknown;
}

function eventTimestamp(event: QueuedEvent): number {
  return Number(event.at ?? event.time ?? 0);
}

/** Returns finite ordering metadata, preferring explicit causal placement over emission order. */
export function eventCausalOrder(event: QueuedEvent): number | null {
  const order = Number(event.causalOrder ?? event.eventOrder);
  return Number.isFinite(order) ? order : null;
}

interface HeapEntry<T extends QueuedEvent> {
  readonly event: T;
  readonly causalOrder: number | null;
  readonly sequence: number;
}

function compareHeapEntries<T extends QueuedEvent>(left: HeapEntry<T>, right: HeapEntry<T>): number {
  return (
    compareEventPlacement(left.event, right.event, left.causalOrder, right.causalOrder) ||
    left.sequence - right.sequence
  );
}

/** Shares one ordering policy while allowing heap entries to retain inherited causal placement. */
function compareEventPlacement(
  left: QueuedEvent,
  right: QueuedEvent,
  leftOrder: number | null,
  rightOrder: number | null
): number {
  const time = eventTimestamp(left) - eventTimestamp(right);
  if (time) return time;
  const priority = Number(left.priority || 0) - Number(right.priority || 0);
  if (priority) return priority;
  return (leftOrder ?? Infinity) - (rightOrder ?? Infinity) || 0;
}

/** Sorts arrays by the queue policy; stable sorting preserves insertion order for ties. */
export function compareQueuedEvents(left: QueuedEvent, right: QueuedEvent): number {
  return compareEventPlacement(left, right, eventCausalOrder(left), eventCausalOrder(right));
}

/**
 * Stable min-heap for resolver event queues. Equal events retain insertion
 * order independently of any causal metadata already present on the event.
 * Resolver-created events inherit the causal order of the event currently
 * being handled, keeping derived effects adjacent to their cause without
 * leaking ordering state between simulations.
 */
export class StableEventQueue<T extends QueuedEvent = QueuedEvent> {
  private readonly heap: HeapEntry<T>[];
  private nextSequence: number;
  currentCausalOrder: number | null;

  constructor(events: readonly T[] = []) {
    this.heap = [...events].map((event, sequence) => ({
      event,
      causalOrder: eventCausalOrder(event),
      sequence
    }));
    this.nextSequence = this.heap.length;
    this.currentCausalOrder = null;
    for (let index = Math.floor(this.heap.length / 2) - 1; index >= 0; index -= 1) {
      this.siftDown(index);
    }
  }

  get length(): number {
    return this.heap.length;
  }

  enqueue(event: T): T {
    const entry: HeapEntry<T> = {
      event,
      causalOrder: eventCausalOrder(event) ?? this.currentCausalOrder,
      sequence: this.nextSequence
    };
    this.nextSequence += 1;
    this.heap.push(entry);
    let index = this.heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareHeapEntries(this.heap[index], this.heap[parent]) >= 0) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
      index = parent;
    }

    return event;
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const first = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.siftDown(0);
    }

    this.currentCausalOrder = first.causalOrder;
    return first.event;
  }

  private siftDown(start: number): void {
    let index = start;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.heap.length && compareHeapEntries(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }

      if (right < this.heap.length && compareHeapEntries(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest === index) return;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

// Independently loaded modules can hold different copies of the queue class.
function isEventQueue<T extends QueuedEvent>(queue: readonly T[] | StableEventQueue<T>): queue is StableEventQueue<T> {
  return !Array.isArray(queue);
}

export function createEventQueue<T extends QueuedEvent>(
  events: readonly T[] | StableEventQueue<T> = []
): StableEventQueue<T> {
  return isEventQueue(events) ? events : new StableEventQueue(events);
}

/**
 * Inserts an event while preserving queue order without a full re-sort.
 */
export function enqueueOrdered<T extends QueuedEvent>(queue: T[] | StableEventQueue<T>, event: T): T {
  if (isEventQueue(queue)) return queue.enqueue(event);
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
export function sortQueuedEvents<T extends QueuedEvent>(queue: T[] | StableEventQueue<T>): T[] | StableEventQueue<T> {
  if (isEventQueue(queue)) return queue;
  return queue.sort(compareQueuedEvents);
}

/**
 * Removes and returns the next event to process.
 */
export function takeNextEvent<T extends QueuedEvent>(queue: T[] | StableEventQueue<T>): T | undefined {
  return isEventQueue(queue) ? queue.dequeue() : queue.shift();
}
