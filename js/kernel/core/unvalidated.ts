/**
 * The one honest name for dynamic input: a value already known to be an object whose properties have not been
 * checked yet. Validation code reads fields from it and returns typed values; nothing else should accept it.
 */
export type UnvalidatedFields = Readonly<Record<string, unknown>>;
