/**
 * Stable event queue helpers used by both scheduling and resolution. Events are
 * ordered by timestamp, priority, causal placement (untagged last), then stable
 * insertion order. Missing or nonfinite causal metadata shares the untagged tier.
 */
export { EPSILON } from '#kernel/core/clock.js';
import { ACTION_SAFETY_LIMIT, canonicalTime, timeKey } from '#kernel/core/clock.js';

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

/** Copy only when normalization is needed, preserving frozen inputs and already canonical event identities. */
export function canonicalEvent<T extends QueuedEvent>(event: T): T {
  const at = canonicalTime(eventTimestamp(event));
  if (event.at != null) return event.at === at ? event : { ...event, at };
  if (event.time != null) return event.time === at ? event : { ...event, time: at };
  return event;
}

/** Returns finite ordering metadata, preferring explicit causal placement over emission order. */
export function eventCausalOrder(event: QueuedEvent): number | null {
  const order = Number(event.causalOrder ?? event.eventOrder);
  return Number.isFinite(order) ? order : null;
}

interface HeapEntry<T extends QueuedEvent> {
  readonly event: T;
  readonly time: number;
  readonly phase: number;
  readonly causalOrder: number | null;
  readonly sequence: number;
}

function compareHeapEntries<T extends QueuedEvent>(left: HeapEntry<T>, right: HeapEntry<T>): number {
  return (
    left.time - right.time ||
    left.phase - right.phase ||
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
  const priority = Number(left.priority || 0) - Number(right.priority || 0);
  if (priority) return priority;
  return (leftOrder ?? Infinity) - (rightOrder ?? Infinity) || 0;
}

/** Sorts arrays by the queue policy; stable sorting preserves insertion order for ties. */
export function compareQueuedEvents(left: QueuedEvent, right: QueuedEvent): number {
  return (
    timeKey(eventTimestamp(left)) - timeKey(eventTimestamp(right)) ||
    compareEventPlacement(left, right, eventCausalOrder(left), eventCausalOrder(right))
  );
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
  private current: { at: number; phase: number } | null = null;
  private sameTimeCount = 0;
  private readonly phaseFor?: (event: T, current: Readonly<{ at: number; phase: number }> | null) => number;
  private readonly safetyLimit: number;

  constructor(
    events: readonly T[] = [],
    options: {
      phaseFor?: (event: T, current: Readonly<{ at: number; phase: number }> | null) => number;
      safetyLimit?: number;
    } = {}
  ) {
    this.phaseFor = options.phaseFor;
    this.safetyLimit = options.safetyLimit ?? ACTION_SAFETY_LIMIT;
    this.currentCausalOrder = null;
    this.heap = [...events].map((event, sequence) => this.entry(event, sequence));
    this.nextSequence = this.heap.length;
    for (let index = Math.floor(this.heap.length / 2) - 1; index >= 0; index -= 1) {
      this.siftDown(index);
    }
  }

  get length(): number {
    return this.heap.length;
  }

  get currentPhase(): number {
    return this.current?.phase ?? 0;
  }
  get currentTime(): number | null {
    return this.current?.at ?? null;
  }

  /** Game-owned phases stay private to heap entries; derived work cannot rewind an already handled instant. */
  private entry(input: T, sequence: number): HeapEntry<T> {
    const event = canonicalEvent(input);
    const at = eventTimestamp(event);
    const phase = this.phaseFor?.(event, this.current) ?? 0;
    if (!Number.isFinite(phase)) throw new RangeError('Event phase must be finite.');
    if (
      this.phaseFor &&
      this.current &&
      (at < this.current.at || (at === this.current.at && phase < this.current.phase))
    ) {
      throw new RangeError(
        `Cannot enqueue past time or phase at ${at}s from ${String(event.sourceId ?? event.type ?? 'event')}.`
      );
    }

    return {
      event,
      time: timeKey(at),
      phase,
      causalOrder: eventCausalOrder(event) ?? this.currentCausalOrder,
      sequence
    };
  }

  enqueue(event: T): T {
    const entry = this.entry(event, this.nextSequence);
    this.nextSequence += 1;
    this.heap.push(entry);
    let index = this.heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareHeapEntries(this.heap[index], this.heap[parent]) >= 0) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
      index = parent;
    }

    return entry.event;
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
    const at = eventTimestamp(first.event);
    this.sameTimeCount = this.current?.at === at ? this.sameTimeCount + 1 : 1;
    this.current = { at, phase: first.phase };
    if (this.phaseFor && this.sameTimeCount > this.safetyLimit) {
      throw new Error(
        `Same-time event safety limit (${this.safetyLimit}) exceeded at ${at}s from ${String(first.event.sourceId ?? first.event.type ?? 'event')}.`
      );
    }

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
