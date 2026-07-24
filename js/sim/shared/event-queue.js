// Stable event queue management with priority ordering
// Contract: sort by time first, then priority, then insertion order for stability

let nextQueueSequence = 1;

// Extract timestamp from event (at or time property)
function eventTime(event) {
  return Number(event.at ?? event.time ?? 0);
}

// Extract priority from event (lower values = higher priority)
function eventPriority(event) {
  return Number(event.priority ?? 0);
}

// Ensure event has sequence metadata for stable insertion order
function ensureQueueMetadata(event) {
  if (event._queueSeq == null) event._queueSeq = nextQueueSequence++;
  return event;
}

// Comparator for event ordering: time → priority → insertion order
export function compareQueuedEvents(a, b) {
  const timeDelta = eventTime(a) - eventTime(b);
  if (timeDelta) return timeDelta;

  const priorityDelta = eventPriority(a) - eventPriority(b);
  if (priorityDelta) return priorityDelta;

  return Number(a._queueSeq ?? 0) - Number(b._queueSeq ?? 0);
}

// Insert event into sorted queue using binary search
export function enqueueOrdered(queue, event) {
  ensureQueueMetadata(event);
  let low = 0;
  let high = queue.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (compareQueuedEvents(queue[middle], event) <= 0) low = middle + 1;
    else high = middle;
  }
  queue.splice(low, 0, event);
  return event;
}

// Sort entire queue in-place using compareQueuedEvents
export function sortQueuedEvents(queue) {
  for (const event of queue) ensureQueueMetadata(event);
  queue.sort(compareQueuedEvents);
  return queue;
}

// Dequeue and return the next event (FIFO)
export function takeNextEvent(queue) {
  return queue.shift();
}
