/**
 * Shared arithmetic for GW2 resources represented as an array of absolute per-stack expiry timestamps.
 *
 * Every function purges expired applications first, so callers never need their own filter pass.
 *
 * Two cap policies live here and are chosen per resource, never inferred. `addTimedStacks` is
 * reject-on-overflow: a grant that would exceed the cap lands partially and never evicts a live
 * application. `grantTimedStacks` is evict-on-overflow: the grant always lands and an existing
 * application dies under an explicitly named retention rule.
 *
 * The comparison is strict (`expiresAt > at`); a stack expiring exactly at `at` is gone. Callers that
 * need an epsilon tolerance own that decision and must not push it down here.
 */

import { boundedInteger } from '#kernel/core/numeric.js';

/** Absolute expiry timestamps, one per live application. */
export type Gw2TimedStackExpiries = readonly number[];

export interface Gw2TimedStackGrant {
  readonly expiries: number[];
  /** Applications that actually landed, which is what a caller reports as the granted stack count. */
  readonly added: number;
}

export interface Gw2TimedStackConsumption {
  readonly expiries: number[];
  /** Applications actually removed, which can fall short of the request when too few were live. */
  readonly consumed: number;
}

/** Drops applications whose window closed at or before `at`. */
export function purgeExpiredStacks(expiries: Gw2TimedStackExpiries, at: number): number[] {
  return expiries.filter((expiresAt) => expiresAt > at);
}

/** Counts the applications still live at `at` without rebuilding the array. */
export function activeStackCount(expiries: Gw2TimedStackExpiries, at: number): number {
  let count = 0;
  for (const expiresAt of expiries) if (expiresAt > at) count += 1;
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
  active.push(...Array.from({ length: added }, () => at + duration));
  return { expiries: active, added };
}

/**
 * Purges, then removes the requested number of applications from the front of the array.
 *
 * Front-of-array is oldest only while the caller keeps the array in application order, which every
 * consumer does today by appending through `addTimedStacks`. Sorting here would reorder a caller that
 * deliberately keeps a different order, so it stays the caller's responsibility.
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
 * application only while the caller keeps the array in application order. A resource that spends its
 * freshest stacks leaves the shortest-lived ones behind, so its total decays sooner than one spending
 * oldest-first, even though both remove the same count.
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
 * These are not interchangeable, and neither is "replace the oldest": oldest grant and earliest expiry
 * coincide only while every application carries the same duration.
 *
 * - `latest-expiry` keeps the greatest deadlines and returns them descending, so a grant shorter-lived
 *   than every survivor is the entry that gets dropped.
 * - `newest-grant` keeps survivor insertion order, appends the grant, and evicts from the front, so an
 *   older application is dropped even when its deadline outlasts the incoming one.
 */
export type Gw2TimedStackRetention = 'latest-expiry' | 'newest-grant';

export interface Gw2TimedStackGrantOptions {
  readonly at: number;
  /** Absolute deadline, so this helper never decides exact versus tick-aligned expiry for its caller. */
  readonly expiresAt: number;
  readonly count: number;
  readonly maximumStacks: number;
  readonly retain: Gw2TimedStackRetention;
}

/**
 * Purges, adds `count` applications expiring at `expiresAt`, then evicts down to the cap.
 *
 * Unlike `addTimedStacks` this never rejects a grant: at the cap the grant lands and an existing
 * application dies under the selected policy. Resources that drop the grant instead keep using
 * `addTimedStacks`.
 *
 * `count` and `maximumStacks` are truncated to non-negative integers here, so a caller whose count can
 * be fractional owns its own rounding before this boundary. A zero `count` is a prune-only request and
 * a zero cap returns empty. A grant already dead at `at` is never retained, matching the strict
 * `expiresAt > at` comparison every reader in this module uses.
 */
export function grantTimedStacks(expiries: Gw2TimedStackExpiries, options: Gw2TimedStackGrantOptions): number[] {
  const maximum = boundedInteger(options.maximumStacks, 0, 0, Number.MAX_SAFE_INTEGER);
  if (maximum === 0) return [];

  const granted = options.expiresAt > options.at ? boundedInteger(options.count, 0, 0, Number.MAX_SAFE_INTEGER) : 0;
  const deadlines = purgeExpiredStacks(expiries, options.at);
  for (let stack = 0; stack < granted; stack += 1) deadlines.push(options.expiresAt);

  if (options.retain === 'latest-expiry') return deadlines.sort((a, b) => b - a).slice(0, maximum);
  return deadlines.slice(Math.max(0, deadlines.length - maximum));
}
