/** Restricts a number to an inclusive range. */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Coerces a value to a finite number, falling back for NaN and infinities. */
export function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
