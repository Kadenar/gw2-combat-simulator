import { isInternalCooldownReady, timeKey } from '#kernel/core/clock.js';

/** Claims a caller-owned ICD after eligibility checks, before effects can trigger another reaction. */
export function tryConsumeProcCooldown(
  readyAtByKey: Record<string, number>,
  key: string | number,
  at: number,
  duration: number
): boolean {
  const readyAt = readyAtByKey[key] ?? 0;
  if (typeof readyAt !== 'number' || Number.isNaN(readyAt)) {
    throw new TypeError('Proc cooldown readyAt must be a number.');
  }

  if (!isInternalCooldownReady(at, readyAt)) return false;
  if (!Number.isFinite(duration) || duration < 0) {
    throw new TypeError('Proc cooldown duration must be a finite non-negative number.');
  }

  const deadline = at + duration;
  timeKey(deadline);
  // Keep caller arithmetic unchanged; the clock predicate canonicalizes comparisons.
  // Zero at time zero remains unarmed, so a zero-duration claim is not a deduplication gate.
  readyAtByKey[key] = deadline;
  return true;
}
