// Shared error presentation helpers.

/**
 * Extracts a human-readable message from a thrown value.
 *
 * The error message, or the stringified value.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
