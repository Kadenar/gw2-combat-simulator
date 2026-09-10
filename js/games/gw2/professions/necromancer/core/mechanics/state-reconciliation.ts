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
    if (Object.hasOwn(snapshot, key)) mutable[key] = structuredClone(snapshot[key]);
    else delete mutable[key];
  }
}
