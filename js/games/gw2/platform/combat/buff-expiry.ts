/**
 * Shared buff deadline checks. A natural deadline stays live through its own timestamp, so hits and ticks tied to
 * the expiry still see the buff. Explicit removal ends a grant immediately, and cleanup work that runs after a
 * timestamp's gameplay treats deadlines at that timestamp as reached.
 */
import { canonicalTime } from '#kernel/core/clock.js';

/** Zero denotes an absent private timer, so it cannot become active at the initial timestamp. */
export function buffDeadlineActive(expiresAt: number, at: number): boolean {
  if (expiresAt === Infinity) return true;

  const expiry = canonicalTime(expiresAt);
  const time = canonicalTime(at);
  return expiry > time || (expiry !== 0 && expiry === time);
}

/** Cleanup tasks expire a timer whose deadline is at or before their own timestamp. */
export function buffDeadlineReached(expiresAt: number, at: number): boolean {
  return expiresAt !== Infinity && canonicalTime(expiresAt) <= canonicalTime(at);
}

/**
 * A grant ends at its removal when gameplay ended it early, otherwise at its natural deadline. `expiresAt` keeps the
 * natural deadline in both cases, so readers that need the actual end use this helper; null means permanent.
 */
export function buffApplicationExpiry(application: {
  readonly expiresAt?: number | null;
  readonly removedAt?: number;
}): number {
  return Math.min(application.expiresAt ?? Infinity, application.removedAt ?? Infinity);
}

/** Finite bounds use the canonical clock; infinities and malformed values compare as given. */
function canonicalBound(value: number): number {
  return Number.isFinite(value) ? canonicalTime(value) : value;
}

/**
 * Explicit removal closes a grant immediately; zero-duration grants never acquire a lifetime. Every bound is compared
 * on the canonical clock, so floating-point noise in a stored start or removal cannot hide or extend a grant.
 */
export function buffWindowActive(at: number, startsAt: number, expiresAt: number, removedAt?: number): boolean {
  const time = canonicalTime(at);
  const start = canonicalBound(startsAt);
  const end = canonicalBound(expiresAt);
  return start <= time && start < end && (removedAt == null || time < canonicalBound(removedAt)) && end >= time;
}
