/**
 * Detached copies of plain simulation data. Engine payloads are plain objects and arrays, so copying them directly
 * avoids the serializer round trip of `structuredClone` on every packet while keeping its observable result.
 */

/**
 * Copies like `structuredClone`: shared references and cycles keep their shape, and functions or symbols throw the
 * same `DataCloneError`. Values other than plain objects and arrays are delegated to `structuredClone` itself.
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
