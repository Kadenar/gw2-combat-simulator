import { eventCausalOrder } from '#kernel/events/queue.js';

/** Independent sorted-array reference for canonical at timestamps, priority, and causal ordering. */
export function compareQueuedEvents(left, right) {
  return (
    Math.round(left.at * 1e6) - Math.round(right.at * 1e6) ||
    Number(left.priority || 0) - Number(right.priority || 0) ||
    (eventCausalOrder(left) ?? Infinity) - (eventCausalOrder(right) ?? Infinity) ||
    0
  );
}
