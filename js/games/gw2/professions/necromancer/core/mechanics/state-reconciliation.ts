const resolverFields = new WeakMap<object, ReadonlySet<string>>();

/** Each state owner declares which fields scheduler snapshots must leave untouched. */
export function registerNecromancerResolverFields<TState extends object>(
  state: TState,
  keys: readonly (keyof TState & string)[]
): void {
  resolverFields.set(state, new Set(keys));
}

/** Restores declared scheduler fields, deleting omitted fields and ignoring unknown snapshot keys. */
export function restoreNecromancerStateSlice(state: object, snapshot: Record<string, unknown>): void {
  const mutable = state as Record<string, unknown>;
  const preserved = resolverFields.get(state);
  for (const key of Object.keys(mutable)) {
    if (preserved?.has(key)) continue;
    if (Object.hasOwn(snapshot, key)) {
      const value = snapshot[key];
      // Primitives are immutable; keep object isolation and structuredClone's rejection of functions and symbols.
      mutable[key] =
        value !== null && (typeof value === 'object' || typeof value === 'function' || typeof value === 'symbol')
          ? structuredClone(value)
          : value;
    } else delete mutable[key];
  }
}
