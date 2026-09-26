/** Cast availability distinguishes permanent denials from commands that can retry at a known time. */
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';

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
