/**
 * Shared floating-point tolerance for timeline comparisons inside the neutral
 * scheduler and resolver.
 */
export const EPSILON = 0.0001;

/**
 * Shared upper bound on scheduler/task-queue iterations. Guards against runaway
 * loops (recurring effects, observation recursion) without capping legitimate
 * long rotations.
 */
export const ACTION_SAFETY_LIMIT = 100_000;

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
 * Internal cooldowns remain active through their recorded boundary timestamp.
 * A proc at exactly readyAt is blocked; only a later timestamp may trigger it.
 *
 * @param {number} at
 * @param {number} [readyAt]
 * @returns {boolean}
 */
export function isInternalCooldownReady(at: number, readyAt = 0): boolean {
  const triggerAt = Number(at);
  const blockedThrough = Number(readyAt);
  // Existing state models use 0 to mean that the ICD has never been armed.
  return blockedThrough === 0 ? triggerAt >= 0 : triggerAt > blockedThrough;
}
