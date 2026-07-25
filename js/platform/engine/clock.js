/**
 * Shared floating-point tolerance for timeline comparisons inside the neutral
 * scheduler and resolver.
 */
export const EPSILON = 0.0001;

/**
 * Returns true when two timeline values should be treated as equal within the
 * engine's tolerance window.
 */
export function nearlyEqual(left, right, epsilon = EPSILON) {
  return Math.abs(Number(left) - Number(right)) <= epsilon;
}

/**
 * Normalizes an arbitrary time-like value into the scheduler's allowed bounds.
 */
export function clampTime(value, minimum = 0, maximum = Infinity) {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}
