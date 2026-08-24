/**
 * Stable event queue helpers used by both scheduling and resolution. Events are
 * ordered by timestamp, then explicit priority, then insertion order.
 */
import type { QueuedEvent } from '../types.js';
import { eventCausalOrder, eventTimestamp } from './events.js';

export { EPSILON } from '../core/clock.js';

interface HeapEntry<T extends QueuedEvent> {
  readonly event: T;
  readonly causalOrder: number | null;
  readonly sequence: number;
}

/**
 * @template {QueuedEvent} T
 * @param {HeapEntry<T>} left
 * @param {HeapEntry<T>} right
 * @returns {number}
 */
function compareHeapEntries<T extends QueuedEvent>(left: HeapEntry<T>, right: HeapEntry<T>): number {
  const eventOrder = compareQueuedEvents(left.event, right.event);
  if (eventOrder) return eventOrder;
  if (left.causalOrder != null && right.causalOrder != null && left.causalOrder !== right.causalOrder) {
    return left.causalOrder - right.causalOrder;
  }

  return left.sequence - right.sequence;
}

/**
 * Sort comparator for queued events.
 *
 * @param {QueuedEvent} left
 * @param {QueuedEvent} right
 * @returns {number}
 */
export function compareQueuedEvents(left: QueuedEvent, right: QueuedEvent): number {
  const time = eventTimestamp(left) - eventTimestamp(right);
  if (time) return time;
  const priority = Number(left.priority || 0) - Number(right.priority || 0);
  if (priority) return priority;
  const leftOrder = eventCausalOrder(left);
  const rightOrder = eventCausalOrder(right);
  return leftOrder != null && rightOrder != null ? leftOrder - rightOrder : 0;
}

/**
 * Stable min-heap for resolver event queues. Equal events retain insertion
 * order independently of any causal metadata already present on the event.
 * Resolver-created events inherit the causal order of the event currently
 * being handled, keeping derived effects adjacent to their cause without
 * leaking ordering state between simulations.
 *
 * @template {QueuedEvent} T
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

  /**
   * @param {T} event
   * @returns {T}
   */
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

  /**
   * @returns {T|undefined}
   */
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

  /**
   * @param {number} start
   * @returns {void}
   */
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

/**
 * @template {QueuedEvent} T
 * @param {readonly T[]|StableEventQueue<T>} [events]
 * @returns {StableEventQueue<T>}
 */
export function createEventQueue<T extends QueuedEvent>(
  events: readonly T[] | StableEventQueue<T> = []
): StableEventQueue<T> {
  return events instanceof StableEventQueue ? events : new StableEventQueue(events);
}

/**
 * Inserts an event while preserving queue order without a full re-sort.
 *
 * @template {QueuedEvent} T
 * @param {T[]|StableEventQueue<T>} queue
 * @param {T} event
 * @returns {T}
 */
export function enqueueOrdered<T extends QueuedEvent>(queue: T[] | StableEventQueue<T>, event: T): T {
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
 *
 * @template {QueuedEvent} T
 * @param {T[]|StableEventQueue<T>} queue
 * @returns {T[]|StableEventQueue<T>}
 */
export function sortQueuedEvents<T extends QueuedEvent>(queue: T[] | StableEventQueue<T>): T[] | StableEventQueue<T> {
  if (queue instanceof StableEventQueue) return queue;
  return queue.sort(compareQueuedEvents);
}

/**
 * Removes and returns the next event to process.
 *
 * @template {QueuedEvent} T
 * @param {T[]|StableEventQueue<T>} queue
 * @returns {T|undefined}
 */
export function takeNextEvent<T extends QueuedEvent>(queue: T[] | StableEventQueue<T>): T | undefined {
  return queue instanceof StableEventQueue ? queue.dequeue() : queue.shift();
}
