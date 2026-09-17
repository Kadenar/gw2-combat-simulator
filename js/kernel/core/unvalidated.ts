/**
 * The one honest name for dynamic input: a value already known to be an object whose properties have not been
 * checked yet. Validation code reads fields from it and returns typed values; nothing else should accept it.
 */
export type UnvalidatedFields = Readonly<Record<string, unknown>>;

/** True for plain objects (not arrays), the only shape whose fields may be read as `UnvalidatedFields`. */
export function isUnvalidatedFields(value: unknown): value is UnvalidatedFields {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/** A dynamic object assembled or mutated by name, whose field names are known only at runtime. */
export type DynamicFields = Record<string, unknown>;
