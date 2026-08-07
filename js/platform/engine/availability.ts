import type { AvailabilityResult } from "./types.js";

/**
 * Folds a sequence of normalized availability outcomes into one result. A
 * non-retryable denial (retryAt == null) is final; otherwise every constraint
 * must be ready and the caller waits for the latest retry timestamp. Ready
 * outcomes are ignored. Callers normalize their own inputs (boolean shorthands,
 * per-owner codes/reasons) before folding.
 */
export function foldAvailability(
  results: Iterable<AvailabilityResult>,
): AvailabilityResult {
  let combined: AvailabilityResult = { ready: true };
  for (const result of results) {
    if (result.ready !== false) continue;
    if (result.retryAt == null) return result;
    const retryAt = Number(result.retryAt);
    if (!Number.isFinite(retryAt)) {
      throw new TypeError("Cast availability retryAt must be finite or null.");
    }
    if (combined.ready || retryAt > Number(combined.retryAt ?? -Infinity)) {
      combined = { ...result, retryAt };
    }
  }
  return combined;
}
