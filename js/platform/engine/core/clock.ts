/**
 * Timing primitives shared across the engine: the floating-point tolerance and
 * iteration safety cap used everywhere, plus the internal-cooldown-ready
 * predicate the scheduler and resolver rely on for timeline math.
 */

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
