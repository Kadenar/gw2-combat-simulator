/** Accept non-null, non-array objects at document and module validation boundaries. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Module declarations share the same object check and labelled validation error. */
export function assertObject(value: object | null | undefined, label: string): void {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
}
