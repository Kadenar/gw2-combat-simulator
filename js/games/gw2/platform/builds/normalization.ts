/** Coerces unvalidated persisted build fields that carry build-specific meaning. */

/** Retains an exact allowed string value and otherwise returns the profession's fallback. */
export function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}
