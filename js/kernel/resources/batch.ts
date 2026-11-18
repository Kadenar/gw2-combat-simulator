/** A count and shared deadline; construction and refresh allocate, while spending and expiry preserve identity. */
import { canonicalTime } from '#kernel/core/clock.js';

export interface Batch {
  count: number;
  expiresAt: number;
}

/** Counts retain finite fractions; an infinite deadline represents an unbounded window. */
export function createBatch(count: number, expiresAt: number): Batch {
  if (!Number.isFinite(count) || count < 0) throw new TypeError('Batch counts must be non-negative and finite.');

  return { count, expiresAt: expiresAt === Infinity ? Infinity : canonicalTime(expiresAt) };
}

/** Whether `at` falls after the deadline; a batch stays live through its own deadline. */
function pastDeadline(batch: Readonly<Batch>, at: number): boolean {
  return batch.expiresAt !== Infinity && canonicalTime(at) > canonicalTime(batch.expiresAt);
}

/** Reads entitlement without mutation, so a later query cannot erase an earlier observation. */
export function activeBatchCount(batch: Readonly<Batch> | undefined, at: number): number {
  if (!batch || batch.count <= 0) return 0;

  return pastDeadline(batch, at) ? 0 : batch.count;
}

/** Refreshes the whole deadline, even at capacity, and reports whether any previous entitlement survived. */
export function refreshBatch(
  previous: Readonly<Batch> | undefined,
  count: number,
  policy: { at: number; expiresAt: number; maximum?: number }
): { batch: Batch; refreshed: boolean } {
  const batch = createBatch(count, policy.expiresAt);
  const maximum = policy.maximum ?? Infinity;

  if (maximum < 0 || Number.isNaN(maximum)) throw new RangeError('Batch capacity must be non-negative.');

  const retained = activeBatchCount(previous, policy.at);
  batch.count = Math.min(maximum, retained + count);
  return { batch, refreshed: retained > 0 };
}

/** Clears a batch that is no longer live at `at`, before raw count reads; a deadline at `at` survives. */
export function purgeExpiredBatch(batch: Batch, at: number): void {
  if (pastDeadline(batch, at)) batch.count = 0;
}

/**
 * Cleanup after a timestamp's work: clears a batch whose deadline is at or before `at`. An old expiry wake cannot
 * clear a later refreshed deadline.
 */
export function expireBatch(batch: Batch, at: number): void {
  if (batch.expiresAt !== Infinity && canonicalTime(at) >= canonicalTime(batch.expiresAt)) batch.count = 0;
}

/**
 * A positive live balance admits the full requested spend in place. Spending can leave a negative remainder when
 * the final entitlement is fractional; non-positive remainders cannot admit another spend.
 */
export function consumeBatch(batch: Batch | undefined, count: number, at: number): boolean {
  if (!Number.isFinite(count) || count <= 0) throw new RangeError('Batch spending must be positive and finite.');

  if (!batch || activeBatchCount(batch, at) === 0) return false;

  batch.count -= count;
  return true;
}
