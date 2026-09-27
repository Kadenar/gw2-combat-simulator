import { eventCausalOrder } from '#kernel/events/queue.js';

/** Independent sorted-array reference for the queue's chronological, priority, and causal ordering. */
export function compareQueuedEvents(left, right) {
  return (
    Math.round(Number(left.at ?? left.time ?? 0) * 1e6) - Math.round(Number(right.at ?? right.time ?? 0) * 1e6) ||
    Number(left.priority || 0) - Number(right.priority || 0) ||
    (eventCausalOrder(left) ?? Infinity) - (eventCausalOrder(right) ?? Infinity) ||
    0
  );
}
