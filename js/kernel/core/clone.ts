/**
 * Copies trusted internal simulation packets and reports by direct traversal to avoid native serialization per packet.
 * Run scripts/analysis/benchmark-clone.mjs to reproduce the comparison. See docs/audits/CLONE-PERFORMANCE.md for
 * input restrictions and result comparisons. The 2026-10-22 Node 24 benchmark reduced simulation time by about 12%
 * across 18 presets. All 151 audited presets produced equal detailed and score results.
 */

/**
 * Accepts primitive data, plain objects with ordinary or null prototypes, and dense ordinary arrays.
 * Enumerable properties must be data properties. Inputs must not contain symbol keys, own `__proto__` keys, extra
 * array properties, functions, symbols, or non-plain objects. Copies preserve shared references and cycles.
 *
 * Use `structuredClone` on the whole graph for unsupported shapes. Sparse arrays, own `__proto__` keys, and aliases
 * crossing a Map, Set, or other native-cloned object boundary have different semantics. Validate payload shapes in
 * the benchmark audit rather than traversing every packet twice. Repeat the audit when adding new payload shapes.
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
