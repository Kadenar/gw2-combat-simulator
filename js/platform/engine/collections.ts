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

/** Inserts after existing equal values so sorted collections retain stable arrival order. */
export function insertSorted<T>(values: T[], value: T, compare: (left: T, right: T) => number): void {
  if (values.length === 0 || compare(values[values.length - 1], value) <= 0) {
    values.push(value);
    return;
  }

  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compare(values[middle], value) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  values.splice(low, 0, value);
}
