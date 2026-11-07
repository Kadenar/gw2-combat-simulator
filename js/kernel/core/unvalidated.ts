/**
 * An object whose properties have not been validated. Validation code reads its fields and returns typed values.
 * Other code should consume those validated types.
 */
export type UnvalidatedFields = Readonly<Record<string, unknown>>;
