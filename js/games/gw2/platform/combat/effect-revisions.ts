// Revisions describe accepted mutations without copying combat state or retaining completed simulations.
const revisions = new WeakMap<object, number>();

/** Invalidate observations when an owner changes windows, including in-place expiry changes. */
export function reviseEffectState(owner: object): void {
  revisions.set(owner, effectStateRevision(owner) + 1);
}

/** Observers can check an owner's revision without scanning its historical applications. */
export function effectStateRevision(owner: object): number {
  return revisions.get(owner) ?? 0;
}
