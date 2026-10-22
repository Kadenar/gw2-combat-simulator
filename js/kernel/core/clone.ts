/**
 * Performance-sensitive copies of trusted internal simulation packets and reports. Direct traversal avoids native
 * serialization on each packet. Reproduce the tradeoff with scripts/analysis/benchmark-clone.mjs; see
 * docs/architecture/CLONE-PERFORMANCE.md for measured speedups, input auditing, and simulation-result parity.
 * The 2026-10-22 Node 24 benchmark cut simulation time by about 12% across 18 presets; all 151 audited presets
 * produced equal detailed and score results. These measurements justify retaining the restricted fast path.
 */

/**
 * Supported inputs are primitive data, plain objects (including null prototypes), and dense ordinary arrays.
 * Enumerable properties must be data properties; exclude symbol keys, own `__proto__` keys, extra array properties,
 * functions, symbols, and non-plain objects. Shared references and cycles within this plain-data graph are preserved.
 *
 * This is deliberately a restricted internal copier, not a general `structuredClone` replacement. Sparse arrays,
 * own `__proto__`, and aliases crossing a Map/Set or other native-cloned object boundary have different semantics.
 * Callers needing those shapes must use `structuredClone` on the whole graph. Keep validation in the benchmark
 * audit rather than adding a second traversal to every hot-path copy; re-audit when introducing new payload shapes.
 */
export function cloneData<T>(value: T): T {
  return copy(value, new Map()) as T;
}

function copy(value: unknown, copies: Map<object, unknown>): unknown {
  if (typeof value !== 'object' || value === null)
    return typeof value === 'function' || typeof value === 'symbol' ? structuredClone(value) : value;

  const existing = copies.get(value);

  if (existing !== undefined) return existing;

  const prototype = Object.getPrototypeOf(value);

  if (prototype === Array.prototype) {
    const source = value as readonly unknown[];
    const array: unknown[] = new Array(source.length);
    copies.set(value, array);
    for (let index = 0; index < source.length; index += 1) array[index] = copy(source[index], copies);
    return array;
  }

  if (prototype !== Object.prototype && prototype !== null) {
    const special = structuredClone(value);
    copies.set(value, special);
    return special;
  }

  const object: Record<string, unknown> = {};
  copies.set(value, object);
  for (const key of Object.keys(value)) object[key] = copy((value as Record<string, unknown>)[key], copies);
  return object;
}
