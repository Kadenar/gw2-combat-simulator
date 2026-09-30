/** Weakly owned gameplay facts must follow their owner when a combat branch is copied. */
const facts: SnapshotFacts<object, unknown>[] = [];

export class SnapshotFacts<K extends object, V> extends WeakMap<K, V> {
  constructor() {
    super();
    facts.push(this);
  }
}

/** Copy one connected graph, retaining aliases and immutable callbacks but no mutable branch data. */
export function cloneCombatGraph<T>(value: T): T {
  const copies = new Map<object, object>();
  function copy(input: unknown): unknown {
    if (input === null || typeof input !== 'object') return input;
    if (copies.has(input)) return copies.get(input);
    const output =
      input instanceof Map
        ? new Map()
        : input instanceof Set
          ? new Set()
          : Array.isArray(input)
            ? []
            : Object.create(Object.getPrototypeOf(input));
    copies.set(input, output);
    if (input instanceof Map) for (const [key, item] of input) output.set(copy(key), copy(item));
    else if (input instanceof Set) for (const item of input) output.add(copy(item));
    else for (const key of Reflect.ownKeys(input)) output[key] = copy(Reflect.get(input, key));
    for (const map of facts) if (map.has(input)) map.set(output, copy(map.get(input)));
    return output;
  }

  return copy(value) as T;
}
