/** Formats result numbers consistently across summary, breakdown, and analysis sections. */
export const resultNumber = (value: unknown): string => Math.round(Number(value || 0)).toLocaleString();

export function signedInteger(value: unknown): string {
  const rounded = Math.round(Number(value || 0));
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return `${normalized > 0 ? '+' : ''}${normalized.toLocaleString()}`;
}

export function signedFixed(value: unknown, digits = 2): string {
  const numeric = Number(value || 0);
  const threshold = 0.5 / 10 ** digits;
  const normalized = Math.abs(numeric) < threshold ? 0 : numeric;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(digits)}`;
}
