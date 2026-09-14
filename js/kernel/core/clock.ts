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

/** Integer microseconds make equality transitive without moving authored events onto a combat tick grid. */
export function timeKey(seconds: number): number {
  const key = Math.round(seconds * 1_000_000);
  if (!Number.isFinite(seconds) || !Number.isSafeInteger(key)) {
    throw new RangeError('Timestamp must be finite and representable as safe integer microseconds.');
  }

  return key === 0 ? 0 : key;
}

/** Public timestamps remain seconds; handlers and ordering must observe the same canonical instant. */
export function canonicalTime(seconds: number): number {
  return timeKey(seconds) / 1_000_000;
}

/** Half-open status windows allow explicit unbounded endpoints without converting infinity to a clock key. */
export function isTimeInWindow(at: number, startsAt: number, expiresAt: number): boolean {
  const time = canonicalTime(at);
  return (
    (startsAt === -Infinity || canonicalTime(startsAt) <= time) &&
    (expiresAt === Infinity || time < canonicalTime(expiresAt))
  );
}

/**
 * Shared upper bound on scheduler/task-queue iterations. Guards against runaway
 * loops (recurring effects, observation recursion) without capping legitimate
 * long rotations.
 */
export const ACTION_SAFETY_LIMIT = 100_000;

/**
 * Internal cooldowns remain active through their recorded boundary timestamp.
 * A proc at exactly readyAt is blocked; only a later timestamp may trigger it.
 */
export function isInternalCooldownReady(at: number, readyAt = 0): boolean {
  const triggerAt = canonicalTime(Number(at));
  // Equipment also uses infinite deadlines as unarmed/permanently blocked sentinels.
  const blockedThrough = Number.isFinite(Number(readyAt)) ? canonicalTime(Number(readyAt)) : Number(readyAt);
  // Existing state models use 0 to mean that the ICD has never been armed.
  return blockedThrough === 0 ? triggerAt >= 0 : triggerAt > blockedThrough;
}
