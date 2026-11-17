/** Independent batches retain their metadata and identity while owners choose expiry and spending order. */
import { canonicalTime, type ExpiryPolicy } from '#kernel/core/clock.js';
import { activeBatchCount, consumeBatch, type Batch } from '#kernel/resources/batch.js';

export interface BatchListPolicy {
  expiry: ExpiryPolicy;
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
    batches.filter((batch) => activeBatchCount(batch, at, policy.expiry) > 0),
    policy.order
  );
}

/**
 * Appends a new independent batch to a new list. Capacity trims only the accepted new batch, in place, so retained
 * references see its admitted count. Existing batches and rejected grants remain untouched; overflow never evicts.
 */
export function appendBatch<T extends Batch>(
  batches: readonly T[],
  batch: T,
  at: number,
  policy: BatchListPolicy & { maximum?: number }
): T[] {
  const maximum = policy.maximum ?? Infinity;

  if (maximum < 0 || Number.isNaN(maximum)) throw new RangeError('Batch capacity must be non-negative.');

  const active = batches.filter((entry) => activeBatchCount(entry, at, policy.expiry) > 0);
  const available = Math.max(0, maximum - active.reduce((sum, entry) => sum + entry.count, 0));
  const added = Math.min(activeBatchCount(batch, at, policy.expiry), available);

  if (added > 0) {
    if (added < batch.count) batch.count = added;

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
  policy: { expiry: ExpiryPolicy; eligible?: (batch: T) => boolean }
): T | undefined {
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];

    if (policy.eligible && !policy.eligible(batch)) continue;

    if (!consumeBatch(batch, 1, at, policy.expiry)) continue;

    if (batch.count <= 0) batches.splice(index, 1);

    return batch;
  }
}
