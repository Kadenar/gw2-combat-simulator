export { EPSILON } from "./clock.js";

let nextQueueSequence = 1;

function ensureMetadata(event) {
  if (event.__order == null && event._queueSeq == null) {
    event._queueSeq = nextQueueSequence++;
  }
  return event;
}

export function compareQueuedEvents(left, right) {
  return Number(left.at ?? left.time ?? 0) - Number(right.at ?? right.time ?? 0)
    || Number(left.priority || 0) - Number(right.priority || 0)
    || Number(left.__order ?? left._queueSeq ?? 0)
      - Number(right.__order ?? right._queueSeq ?? 0);
}

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

export function sortQueuedEvents(queue) {
  for (const event of queue) ensureMetadata(event);
  return queue.sort(compareQueuedEvents);
}

export function takeNextEvent(queue) {
  return queue.shift();
}
