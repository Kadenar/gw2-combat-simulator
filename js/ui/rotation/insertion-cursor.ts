/** Normalizes the application-owned insertion cursor against the current authored rotation length. */
export function normalizeRotationInsertionIndex(value: unknown, rotationLength: number): number | null {
  const length = Math.max(0, Math.floor(Number(rotationLength) || 0));
  if (value === null || value === undefined || value === '') return null;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index <= length ? index : null;
}
