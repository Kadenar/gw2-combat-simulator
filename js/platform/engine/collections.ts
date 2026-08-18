/**
 * Normalizes a Map or plain-object record into string-keyed entry tuples so
 * catalog and hook composition can treat both source shapes uniformly.
 */
export function toEntries<V>(
  value: ReadonlyMap<string, V> | Readonly<Record<string, V>> | null | undefined
): [string, V][] {
  return value instanceof Map
    ? [...value.entries()].map(([key, val]) => [String(key), val])
    : Object.entries(value ?? {});
}
