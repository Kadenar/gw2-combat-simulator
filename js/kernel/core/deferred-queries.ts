/** Frozen query views resolve their current owner only when invoked, preserving deferred binding and replacement. */
export function createDeferredQueries<
  TOwner extends Record<TKey, (...args: never[]) => unknown>,
  TKey extends keyof TOwner
>(readOwner: () => TOwner, keys: readonly TKey[]): Readonly<Pick<TOwner, TKey>> {
  // Each wrapper forwards the selected method's arguments and receiver; omitted methods never exist on the view.
  return Object.freeze(
    Object.fromEntries(
      keys.map((key) => [
        key,
        (...args: unknown[]) => {
          const owner = readOwner();
          return Reflect.apply(owner[key], owner, args);
        }
      ])
    ) as unknown as Pick<TOwner, TKey>
  );
}
