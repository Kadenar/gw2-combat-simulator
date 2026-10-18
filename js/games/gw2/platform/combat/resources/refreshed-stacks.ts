import { canonicalTime } from '#kernel/core/clock.js';

/** A capped buff whose stacks share one owner-calculated absolute deadline. */
export interface RefreshedStacks {
  stacks: number;
  expiresAt: number;
}

/** Queries without expiring live storage; each mechanic explicitly chooses its final-timestamp policy. */
export function activeRefreshedStacks(
  state: Readonly<RefreshedStacks> | undefined,
  at: number,
  expiry: 'inclusive' | 'exclusive'
): number {
  if (!state) return 0;

  // Compare canonical instants while retaining the owner's final-timestamp and unbounded-preview policies.
  const time = canonicalTime(at);
  const expiresAt = state.expiresAt === Infinity ? Infinity : canonicalTime(state.expiresAt);
  return (expiry === 'inclusive' ? time <= expiresAt : time < expiresAt) ? state.stacks : 0;
}

/** Settles expiration before adding to the cap, refreshing the common deadline even when already full. */
export function grantRefreshedStacks(
  state: Readonly<RefreshedStacks>,
  count: number,
  at: number,
  expiresAt: number,
  maximum: number,
  expiry: 'inclusive' | 'exclusive'
): RefreshedStacks {
  return {
    stacks: Math.min(maximum, activeRefreshedStacks(state, at, expiry) + count),
    expiresAt: expiresAt === Infinity ? Infinity : canonicalTime(expiresAt)
  };
}
