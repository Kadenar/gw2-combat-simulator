/**
 * Shared arithmetic for resources represented as per-stack deadlines or timestamped applications.
 *
 * Every function purges expired applications first, so callers never need their own filter pass.
 *
 * Cap policies live here and are chosen per resource, never inferred. `addTimedStacks` is
 * reject-on-overflow: a grant that would exceed the cap lands partially and never evicts an application
 * that outlives this timestamp. `grantTimedStacks` combines survivors and grants, then retains applications
 * under an explicitly named rule; that rule can discard either an existing stack or the incoming grant.
 *
 * A stack stays live through its own deadline, so work tied to that timestamp still reads it. New grants
 * need a deadline after their own timestamp. Cleanup that runs after a timestamp's work uses `expireStacks`.
 */

import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { boundedInteger } from '#kernel/core/numeric.js';

/** Absolute expiry timestamps, one per live application. */
type TimedStackExpiries = readonly number[];

interface TimedStackGrant {
  readonly expiries: number[];
  /** Number of applications that landed, reported as the granted stack count. */
  readonly added: number;
}

interface TimedStackConsumption {
  readonly expiries: number[];
  /** Number of applications removed. May be less than requested if too few were active. */
  readonly consumed: number;
}

/** A deadline remains live at equality; stored timestamps never receive padding. */
function stackActive(expiresAt: number, at: number): boolean {
  return expiresAt === Infinity || canonicalTime(at) <= canonicalTime(expiresAt);
}

/** Drops applications that are no longer live while retaining application order for oldest/newest consumption. */
export function purgeExpiredStacks(expiries: TimedStackExpiries, at: number): number[] {
  return expiries.filter((expiresAt) => stackActive(expiresAt, at));
}

/** Cleanup after a timestamp's work also drops applications whose deadline is that timestamp. */
export function expireStacks(expiries: TimedStackExpiries, at: number): number[] {
  return expiries.filter((expiresAt) => isTimeInWindow(at, -Infinity, expiresAt));
}

/** Counts the applications still live at `at` without rebuilding the array. */
export function activeStackCount(expiries: TimedStackExpiries, at: number): number {
  let count = 0;
  for (const expiresAt of expiries) if (stackActive(expiresAt, at)) count += 1;
  return count;
}

/** Purges, then adds as many applications expiring at `at + duration` as the cap still admits. */
export function addTimedStacks(
  expiries: TimedStackExpiries,
  stacks: number,
  at: number,
  duration: number,
  maximum: number
): TimedStackGrant {
  const active = purgeExpiredStacks(expiries, at);
  // Match event-clock precision without changing exact lifetimes or unbounded preview stacks.
  const expiresAt = at + duration === Infinity ? Infinity : canonicalTime(at + duration);

  if (!isTimeInWindow(at, -Infinity, expiresAt)) return { expiries: active, added: 0 };

  // Stacks ending at this timestamp remain readable, but cannot block a grant that outlives it.
  const survivors = active.filter((deadline) => isTimeInWindow(at, -Infinity, deadline)).length;
  const added = boundedInteger(stacks, 0, 0, Math.max(0, maximum - survivors));
  let replacements = Math.max(0, active.length + added - maximum);
  const retained = active.filter((deadline) => {
    if (replacements > 0 && !isTimeInWindow(at, -Infinity, deadline)) {
      replacements--;
      return false;
    }

    return true;
  });
  retained.push(...Array.from({ length: added }, () => expiresAt));
  return { expiries: retained, added };
}

/**
 * Purges, then removes the requested number of applications from the front of the array.
 *
 * Front-of-array is oldest only while the caller keeps application order. An expiry-sorted caller
 * spends its earliest deadline instead. Sorting stays the caller's responsibility.
 */
export function consumeOldestStacks(expiries: TimedStackExpiries, stacks: number, at: number): TimedStackConsumption {
  const active = purgeExpiredStacks(expiries, at);
  const consumed = boundedInteger(stacks, 0, 0, active.length);
  active.splice(0, consumed);
  return { expiries: active, consumed };
}

/**
 * Purges, then removes the requested number of applications from the back of the array.
 *
 * The mirror of `consumeOldestStacks`, and it inherits the same caveat: back-of-array is the newest
 * application only while the caller keeps application order. Newest grant and latest expiry need
 * not coincide when durations vary.
 */
export function consumeNewestStacks(expiries: TimedStackExpiries, stacks: number, at: number): TimedStackConsumption {
  const active = purgeExpiredStacks(expiries, at);
  const consumed = boundedInteger(stacks, 0, 0, active.length);
  active.splice(active.length - consumed, consumed);
  return { expiries: active, consumed };
}

/**
 * Cap policy for a grant that cannot fit under `maximumStacks`.
 *
 * These are not interchangeable: oldest grant and earliest expiry
 * coincide only while every application carries the same duration.
 *
 * - `latest-expiry` keeps the greatest deadlines and returns them descending, so a grant shorter-lived
 *   than every survivor is the entry that gets dropped.
 * - `newest-grant` keeps survivor insertion order, appends the grant, and evicts from the front, so an
 *   older application is dropped even when its deadline outlasts the incoming one.
 * - `replace-earliest` evicts the earliest existing deadline before each insertion. Short-lived grants
 *   can replace one another while longer-lived survivors remain. Even an immediately expired grant
 *   evicts a stack when full, but never remains in storage.
 */
type TimedStackRetention = 'latest-expiry' | 'newest-grant' | 'replace-earliest';

interface TimedStackGrantOptions {
  readonly at: number;
  /** Absolute deadline, so this helper never decides exact versus tick-aligned expiry for its caller. */
  readonly expiresAt: number;
  readonly count: number;
  readonly maximumStacks: number;
  readonly retain: TimedStackRetention;
}

/**
 * Purges and admits `count` applications under the explicitly selected cap policy.
 *
 * Unlike `addTimedStacks`, this can evict existing applications. `latest-expiry` can discard an incoming
 * grant if its deadline is shorter than every survivor; `newest-grant` retains it ahead of older grants.
 * `replace-earliest` evicts before each insertion, including a grant that is already expired.
 *
 * `count` and `maximumStacks` are truncated to non-negative integers here, so a caller whose count can
 * be fractional owns its own rounding before this boundary. A zero `count` still prunes and caps, and
 * a zero cap returns empty. A grant whose deadline does not follow `at` is never retained.
 */
export function grantTimedStacks(expiries: TimedStackExpiries, options: TimedStackGrantOptions): number[] {
  return grantStackEntries(
    expiries,
    options,
    (expiry) => expiry,
    (expiry) => expiry
  );
}

/** Timestamped stacks retain their start times so future applications cannot occupy today's capacity. */
interface TimedStackApplication {
  readonly at: number;
  readonly expiresAt: number;
}

/** Grants started applications using the shared cap policy; pending existing applications keep their own starts. */
export function grantTimedStackApplications<T extends TimedStackApplication>(
  applications: readonly T[],
  application: T,
  options: Omit<TimedStackGrantOptions, 'expiresAt'>
): T[] {
  if (canonicalTime(application.at) > canonicalTime(options.at))
    throw new RangeError('Timed stack grants cannot precede their application start.');

  const pending = applications.filter(
    (entry) => canonicalTime(entry.at) > canonicalTime(options.at) && stackActive(entry.expiresAt, options.at)
  );
  const started = applications.filter((entry) => canonicalTime(entry.at) <= canonicalTime(options.at));
  return [
    ...grantStackEntries(
      started,
      { ...options, expiresAt: application.expiresAt },
      (entry) => entry.expiresAt,
      (expiresAt) => ({ ...application, at: canonicalTime(application.at), expiresAt })
    ),
    ...pending
  ];
}

/** Apply each replacement before inserting its grant; retaining the longest deadlines is a separate policy. */
function grantStackEntries<T>(
  entries: readonly T[],
  options: TimedStackGrantOptions,
  expiryOf: (entry: T) => number,
  create: (expiresAt: number) => T
): T[] {
  const maximum = boundedInteger(options.maximumStacks, 0, 0, Number.MAX_SAFE_INTEGER);

  if (maximum === 0) return [];

  const expiresAt = options.expiresAt === Infinity ? Infinity : canonicalTime(options.expiresAt);
  const live = isTimeInWindow(options.at, -Infinity, expiresAt);
  const count = boundedInteger(options.count, 0, 0, Number.MAX_SAFE_INTEGER);
  const active = entries.filter((entry) => stackActive(expiryOf(entry), options.at));

  if (options.retain === 'replace-earliest') {
    // Reconcile a lowered cap before the next grant, retaining the longest-lived existing applications.
    if (active.length > maximum) {
      active.sort((left, right) => expiryOf(left) - expiryOf(right));
      active.splice(0, active.length - maximum);
    }

    for (let stack = 0; stack < count; stack += 1) {
      if (active.length >= maximum) {
        active.sort((left, right) => expiryOf(left) - expiryOf(right));
        active.shift();
      }

      if (live) active.push(create(expiresAt));
    }

    return active;
  }

  for (let stack = 0; stack < (live ? count : 0); stack += 1) active.push(create(expiresAt));

  if (options.retain === 'latest-expiry') return active.sort((a, b) => expiryOf(b) - expiryOf(a)).slice(0, maximum);

  return active.slice(Math.max(0, active.length - maximum));
}
