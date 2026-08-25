/**
 * Cast-availability folding. Combines the per-constraint availability outcomes
 * a skill accumulates into a single verdict, so the scheduler learns whether a
 * cast is ready, permanently blocked, or must wait until a retry timestamp.
 */
import type { AvailabilityResult } from '../types.js';

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

/** Enforces the single structured cast-admission protocol at untyped extension boundaries. */
export function assertAvailabilityResult(result: unknown, owner: string): AvailabilityResult {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError(`${owner} must return an AvailabilityResult.`);
  }

  const candidate = result as Partial<AvailabilityResult> & Record<string, unknown>;
  if (candidate.ready === true) return CAST_READY;
  if (candidate.ready !== false) {
    throw new TypeError(`${owner} must return an AvailabilityResult with a boolean ready field.`);
  }

  const code = typeof candidate.code === 'string' ? candidate.code.trim() : '';
  const reason = typeof candidate.reason === 'string' ? candidate.reason.trim() : '';
  if (!code || !reason) {
    throw new TypeError(`${owner} denial must include a non-empty code and reason.`);
  }

  if (candidate.retryAt === null) return denyCast(code, reason);
  if (typeof candidate.retryAt !== 'number' || !Number.isFinite(candidate.retryAt)) {
    throw new TypeError(`${owner} denial retryAt must be a finite number or null.`);
  }

  return retryCast(candidate.retryAt, code, reason);
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
