/**
 * Stable event queue helpers used by both scheduling and resolution. Events are
 * ordered by timestamp, then explicit priority, then insertion order.
 */
export { EPSILON } from "./clock.js";

let nextQueueSequence = 1;

/**
 * Adds deterministic insertion metadata for events that were not created
 * through the scheduler's normal event factory path.
 */
function ensureMetadata(event) {
  if (event.__order == null && event._queueSeq == null) {
    event._queueSeq = nextQueueSequence++;
  }
  return event;
}

/**
 * Sort comparator for queued events.
 */
export function compareQueuedEvents(left, right) {
  return Number(left.at ?? left.time ?? 0) - Number(right.at ?? right.time ?? 0)
    || Number(left.priority || 0) - Number(right.priority || 0)
    || Number(left.causalOrder ?? left.__order ?? left._queueSeq ?? 0)
      - Number(right.causalOrder ?? right.__order ?? right._queueSeq ?? 0);
}

/**
 * Inserts an event while preserving queue order without a full re-sort.
 */
export function enqueueOrdered(queue, event) {
  ensureMetadata(event);
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
  for (const event of queue) ensureMetadata(event);
  return queue.sort(compareQueuedEvents);
}

/**
 * Removes and returns the next event to process.
 */
export function takeNextEvent(queue) {
  return queue.shift();
}
