/** Freezes patched catalog data recursively so previews cannot mutate canonical runtime declarations. */
export function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

/** Catalog declarations are plain records and arrays; copy mutable data while retaining executable predicates. */
export function cloneCatalogData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneCatalogData) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneCatalogData(child)])) as T;
  return value;
}
