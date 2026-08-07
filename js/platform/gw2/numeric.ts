/** Restricts a number to an inclusive range. */
export function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Coerces a value to a finite number, falling back for NaN and infinities. */
export function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
