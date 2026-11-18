/** Independent batches retain their metadata and identity while owners choose spending order. */
import { canonicalTime } from '#kernel/core/clock.js';
import { activeBatchCount, consumeBatch, type Batch } from '#kernel/resources/batch.js';

export interface BatchListPolicy {
  order: 'earliest-expiry' | 'insertion';
}

/** Orders a newly allocated list; equal deadlines retain insertion order, including unbounded batches. */
function orderBatches<T extends Batch>(batches: T[], order: BatchListPolicy['order']): T[] {
  if (order === 'insertion') return batches;

  return batches.sort((left, right) => {
    const a = left.expiresAt === Infinity ? Infinity : canonicalTime(left.expiresAt);
    const b = right.expiresAt === Infinity ? Infinity : canonicalTime(right.expiresAt);
    return a === b ? 0 : a < b ? -1 : 1;
  });
}

/** Reads live batches into a new list without changing the input list or its batch objects. */
export function activeBatches<T extends Batch>(batches: readonly T[], at: number, policy: BatchListPolicy): T[] {
  return orderBatches(
    batches.filter((batch) => activeBatchCount(batch, at) > 0),
    policy.order
  );
}

/** Whether a batch remains after `at`; a batch ending at `at` is readable then but holds no later capacity. */
function outlives(batch: Readonly<Batch>, at: number): boolean {
  return batch.expiresAt === Infinity || canonicalTime(at) < canonicalTime(batch.expiresAt);
}

/**
 * Appends a new independent batch to a new list. Capacity trims only the accepted new batch, in place, so retained
 * references see its admitted count. Batches that outlive `at` are never evicted; one ending at `at` leaves the list
 * only when the new grant needs its capacity. A new batch must outlive `at`. Rejected grants remain untouched.
 */
export function appendBatch<T extends Batch>(
  batches: readonly T[],
  batch: T,
  at: number,
  policy: BatchListPolicy & { maximum?: number }
): T[] {
  const maximum = policy.maximum ?? Infinity;

  if (maximum < 0 || Number.isNaN(maximum)) throw new RangeError('Batch capacity must be non-negative.');

  const active = batches.filter((entry) => activeBatchCount(entry, at) > 0);
  const reserved = active.filter((entry) => outlives(entry, at)).reduce((sum, entry) => sum + entry.count, 0);
  const added = outlives(batch, at) ? Math.min(activeBatchCount(batch, at), Math.max(0, maximum - reserved)) : 0;

  if (added > 0) {
    if (added < batch.count) batch.count = added;

    let excess = active.reduce((sum, entry) => sum + entry.count, 0) + added - maximum;
    for (let index = 0; excess > 0 && index < active.length;) {
      if (outlives(active[index], at)) {
        index += 1;
        continue;
      }

      excess -= active[index].count;
      active.splice(index, 1);
    }

    active.push(batch);
  }

  return orderBatches(active, policy.order);
}

/**
 * Spends one unit from the first eligible live batch in the retained order. Mutates that batch, removes it from the
 * supplied list when exhausted, and returns the same object for attribution. Other entries remain untouched.
 */
export function consumeBatchFromList<T extends Batch>(
  batches: T[],
  at: number,
  policy: { eligible?: (batch: T) => boolean } = {}
): T | undefined {
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];

    if (policy.eligible && !policy.eligible(batch)) continue;

    if (!consumeBatch(batch, 1, at)) continue;

    if (batch.count <= 0) batches.splice(index, 1);

    return batch;
  }
}
