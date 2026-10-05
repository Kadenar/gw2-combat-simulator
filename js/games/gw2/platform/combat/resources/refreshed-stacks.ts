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
  return (expiry === 'inclusive' ? at <= state.expiresAt : at < state.expiresAt) ? state.stacks : 0;
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
  return { stacks: Math.min(maximum, activeRefreshedStacks(state, at, expiry) + count), expiresAt };
}
