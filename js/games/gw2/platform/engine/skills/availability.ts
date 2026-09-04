/**
 * Cast-availability folding. Combines the per-constraint availability outcomes
 * a skill accumulates into a single verdict, so the scheduler learns whether a
 * cast is ready, permanently blocked, or must wait until a retry timestamp.
 */
import type { AvailabilityResult } from '#gw2/platform/engine/execution/types.js';

export const CAST_READY: AvailabilityResult = Object.freeze({ ready: true });

/** Creates a command-scoped denial when time alone cannot make the attempted cast valid. */
export function denyCast(code: string, reason: string): AvailabilityResult {
  return { ready: false, retryAt: null, code, reason };
}

/** Creates a waitable denial with the exact simulation time at which every rule should be evaluated again. */
export function retryCast(retryAt: number, code: string, reason: string): AvailabilityResult {
  if (!Number.isFinite(retryAt)) {
    throw new TypeError('Cast availability retryAt must be finite.');
  }

  return { ready: false, retryAt, code, reason };
}

/**
 * Folds a sequence of normalized availability outcomes into one result. A
 * non-retryable denial (retryAt == null) is final; otherwise every constraint
 * must be ready and the caller waits for the latest retry timestamp. Ready
 * outcomes are ignored. Callers validate untyped extension results before
 * folding them.
 */
export function foldAvailability(results: Iterable<AvailabilityResult>): AvailabilityResult {
  let combined: AvailabilityResult = CAST_READY;
  for (const result of results) {
    if (result.ready !== false) continue;
    if (result.retryAt == null) return result;
    const retryAt = Number(result.retryAt);
    if (!Number.isFinite(retryAt)) {
      throw new TypeError('Cast availability retryAt must be finite or null.');
    }

    if (combined.ready || retryAt > Number(combined.retryAt ?? -Infinity)) {
      combined = { ...result, retryAt };
    }
  }

  return combined;
}
