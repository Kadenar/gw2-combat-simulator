/** Restricts a number to an inclusive range. */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Coerces a value to a finite number, falling back for NaN and infinities. */
export function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Final effect durations use half-even whole milliseconds; expiration stays relative to the application time. */
export function roundEffectDuration(duration: number): number {
  if (!Number.isFinite(duration)) throw new RangeError('Effect duration must be finite.');
  return roundHalfToEven(Math.max(0, duration) * 1000) / 1000;
}

/** Rounds to even on half ties, allowing for accumulated floating-point noise in damage and duration arithmetic. */
export function roundHalfToEven(value: number): number {
  const lower = Math.floor(value);
  // Cover accumulated formula arithmetic; cap tolerance so large values retain distinct fractions.
  const tolerance = Math.min(1e-7, 32 * Number.EPSILON * Math.max(1, Math.abs(value)));
  return Math.abs(value - lower - 0.5) <= tolerance ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(value);
}

interface ExpectedCriticalProgressState {
  criticalProgress: number;
}

export const EXPECTED_CRITICAL_PROGRESS_TOLERANCE = 1e-9;

/**
 * Adds one hit's expected critical chance and consumes a completed critical.
 * Near-threshold floating-point noise is clamped out of the retained remainder.
 */
export function consumeExpectedCriticalProgress(state: ExpectedCriticalProgressState, chance: number): boolean {
  const progress = state.criticalProgress + chance;
  if (progress < 1 - EXPECTED_CRITICAL_PROGRESS_TOLERANCE) {
    state.criticalProgress = progress;
    return false;
  }

  state.criticalProgress = Math.max(0, progress - 1);
  return true;
}
