/** Coerces a build scalar, substitutes only NaN, and clamps infinities to the requested bounds. */
export function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const numeric = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isNaN(numeric) ? fallback : numeric));
}

/** Applies integer truncation before bounding a persisted numeric build scalar. */
export function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const numeric = Number(value);
  const normalized = Number.isNaN(numeric) ? fallback : numeric;
  return Math.max(minimum, Math.min(maximum, Math.trunc(normalized)));
}

/** Retains an exact allowed string value and otherwise returns the profession's fallback. */
export function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}
