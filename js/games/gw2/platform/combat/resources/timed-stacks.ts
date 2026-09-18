/**
 * Shared arithmetic for GW2 resources represented as an array of absolute per-stack expiry timestamps.
 *
 * Every function purges expired applications first, so callers never need their own filter pass. The
 * add policy here is reject-on-overflow: a grant that would exceed the cap lands partially and never
 * evicts a live application. Resources whose cap evicts the oldest stack instead are a different rule
 * and must not route through `addTimedStacks`.
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
