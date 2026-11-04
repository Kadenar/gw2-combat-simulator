const CLONE_OWNER_PREFIX = 'mesmer.clone:';

/** Tasks, packets, companion grants, and retirement share one identity derived from the run's unique clone ID. */
export function mesmerCloneOwnerId(cloneId: number): string {
  return `${CLONE_OWNER_PREFIX}${cloneId}`;
}

/** Summon attribution may also name phantasms; only clone identities acquire the clone's lifetime. */
export function isMesmerCloneOwnerId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(CLONE_OWNER_PREFIX);
}
