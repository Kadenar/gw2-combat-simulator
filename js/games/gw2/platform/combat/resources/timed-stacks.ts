/**
 * Shared arithmetic for GW2 resources represented as per-stack deadlines or timestamped applications.
 *
 * Every function purges expired applications first, so callers never need their own filter pass.
 *
 * Cap policies live here and are chosen per resource, never inferred. `addTimedStacks` is
 * reject-on-overflow: a grant that would exceed the cap lands partially and never evicts a live
 * application. `grantTimedStacks` combines survivors and grants, then retains applications under
 * an explicitly named rule; that rule can discard either an existing stack or the incoming grant.
 *
 * The comparison is strict (`expiresAt > at`); a stack expiring exactly at `at` is gone. Callers that
 * need inclusive expiry own that decision and must not extend the canonical deadline.
 */

import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { boundedInteger } from '#kernel/core/numeric.js';

/** Absolute expiry timestamps, one per live application. */
type Gw2TimedStackExpiries = readonly number[];

interface Gw2TimedStackGrant {
  readonly expiries: number[];
  /** Number of applications that landed, reported as the granted stack count. */
  readonly added: number;
}

interface Gw2TimedStackConsumption {
  readonly expiries: number[];
  /** Number of applications removed. May be less than requested if too few were active. */
  readonly consumed: number;
}

/** Drops closed windows while retaining application order for oldest/newest consumption. */
export function purgeExpiredStacks(expiries: Gw2TimedStackExpiries, at: number): number[] {
  return expiries.filter((expiresAt) => isTimeInWindow(at, -Infinity, expiresAt));
}

/** Counts the applications still live at `at` without rebuilding the array. */
export function activeStackCount(expiries: Gw2TimedStackExpiries, at: number): number {
  let count = 0;
  for (const expiresAt of expiries) if (isTimeInWindow(at, -Infinity, expiresAt)) count += 1;
  return count;
}

/** Purges, then adds as many applications expiring at `at + duration` as the cap still admits. */
export function addTimedStacks(
  expiries: Gw2TimedStackExpiries,
  stacks: number,
  at: number,
  duration: number,
  maximum: number
): Gw2TimedStackGrant {
  const active = purgeExpiredStacks(expiries, at);
  const added = boundedInteger(stacks, 0, 0, Math.max(0, maximum - active.length));
  // Match event-clock precision without changing exact lifetimes or unbounded preview stacks.
  const expiresAt = at + duration === Infinity ? Infinity : canonicalTime(at + duration);
  active.push(...Array.from({ length: added }, () => expiresAt));
  return { expiries: active, added };
}

/**
 * Purges, then removes the requested number of applications from the front of the array.
 *
 * Front-of-array is oldest only while the caller keeps application order. An expiry-sorted caller
 * spends its earliest deadline instead. Sorting stays the caller's responsibility.
 */
export function consumeOldestStacks(
  expiries: Gw2TimedStackExpiries,
  stacks: number,
  at: number
): Gw2TimedStackConsumption {
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
export function consumeNewestStacks(
  expiries: Gw2TimedStackExpiries,
  stacks: number,
  at: number
): Gw2TimedStackConsumption {
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
type Gw2TimedStackRetention = 'latest-expiry' | 'newest-grant' | 'replace-earliest';

interface Gw2TimedStackGrantOptions {
  readonly at: number;
  /** Absolute deadline, so this helper never decides exact versus tick-aligned expiry for its caller. */
  readonly expiresAt: number;
  readonly count: number;
  readonly maximumStacks: number;
  readonly retain: Gw2TimedStackRetention;
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
 * a zero cap returns empty. A grant already dead at `at` is never retained, matching the strict
 * `expiresAt > at` comparison every reader in this module uses.
 */
export function grantTimedStacks(expiries: Gw2TimedStackExpiries, options: Gw2TimedStackGrantOptions): number[] {
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
  options: Omit<Gw2TimedStackGrantOptions, 'expiresAt'>
): T[] {
  if (canonicalTime(application.at) > canonicalTime(options.at))
    throw new RangeError('Timed stack grants cannot precede their application start.');

  const pending = applications.filter(
    (entry) =>
      canonicalTime(entry.at) > canonicalTime(options.at) && isTimeInWindow(options.at, -Infinity, entry.expiresAt)
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
  options: Gw2TimedStackGrantOptions,
  expiryOf: (entry: T) => number,
  create: (expiresAt: number) => T
): T[] {
  const maximum = boundedInteger(options.maximumStacks, 0, 0, Number.MAX_SAFE_INTEGER);

  if (maximum === 0) return [];

  const expiresAt = options.expiresAt === Infinity ? Infinity : canonicalTime(options.expiresAt);
  const live = isTimeInWindow(options.at, -Infinity, expiresAt);
  const count = boundedInteger(options.count, 0, 0, Number.MAX_SAFE_INTEGER);
  const active = entries.filter((entry) => isTimeInWindow(options.at, -Infinity, expiryOf(entry)));

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
