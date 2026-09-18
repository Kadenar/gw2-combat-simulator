/** Game-agnostic numeric helpers shared by the kernel, games, applications, and neutral UI. */

/** Restricts a number to an inclusive range. */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Rounds to even on half ties, allowing for accumulated floating-point noise in damage and duration arithmetic. */
export function roundHalfToEven(value: number): number {
  const lower = Math.floor(value);
  // Cover accumulated formula arithmetic; cap tolerance so large values retain distinct fractions.
  const tolerance = Math.min(1e-7, 32 * Number.EPSILON * Math.max(1, Math.abs(value)));
  return Math.abs(value - lower - 0.5) <= tolerance ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(value);
}

/** Coerces a value to a finite number, falling back for NaN and infinities. */
export function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Coerces a scalar, substitutes the fallback only for NaN, and clamps infinities to the requested bounds.
 * Unlike `finiteNumber`, an infinite input clamps into range rather than taking the fallback.
 */
export function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const numeric = Number(value);
  return clamp(Number.isNaN(numeric) ? fallback : numeric, minimum, maximum);
}

/** Applies integer truncation before bounding a coerced scalar. */
export function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const numeric = Number(value);
  return clamp(Math.trunc(Number.isNaN(numeric) ? fallback : numeric), minimum, maximum);
}
