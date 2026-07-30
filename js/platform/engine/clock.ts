/**
 * Shared floating-point tolerance for timeline comparisons inside the neutral
 * scheduler and resolver.
 */
export const EPSILON = 0.0001;

/**
 * Returns true when two timeline values should be treated as equal within the
 * engine's tolerance window.
 *
 * @param {number} left
 * @param {number} right
 * @param {number} [epsilon]
 * @returns {boolean}
 */
export function nearlyEqual(
  left: number,
  right: number,
  epsilon = EPSILON,
): boolean {
  return Math.abs(Number(left) - Number(right)) <= epsilon;
}

/**
 * Normalizes an arbitrary time-like value into the scheduler's allowed bounds.
 *
 * @param {number} value
 * @param {number} [minimum]
 * @param {number} [maximum]
 * @returns {number}
 */
export function clampTime(
  value: number,
  minimum = 0,
  maximum = Infinity,
): number {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}
