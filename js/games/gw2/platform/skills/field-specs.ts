/**
 * Declares which fields skills and balance profiles may carry. The platform owns the vocabulary its own code reads; each profession
 * module contributes the fields that only its code reads. One record per field drives catalog validation, the patch
 * allowlist, and authoring labels, so no other registry repeats the field name.
 */

/** Units select the editor suffix; stored values keep their declared unit. */
export type FieldUnit = 'seconds' | 'milliseconds' | 'probability' | 'fraction' | 'factor' | 'attribute' | 'percent';

/** Numeric tuning or timing whose bounds are enforced on every authored and patched catalog. */
export interface NumericFieldSpec {
  readonly kind: 'number';
  /** Author-facing name; when omitted, labels split the camel-case key. */
  readonly label?: string;
  readonly unit?: FieldUnit;
  /** Inclusive lower bound; omitted means zero, because catalog tuning is nonnegative unless declared otherwise. */
  readonly minimum?: number;
  /** Inclusive upper bound. */
  readonly maximum?: number;
  /** Patches may edit the value; advanced fields sit behind the editor's calibration disclosure. */
  readonly patch?: 'primary' | 'advanced';
  /** Timing internals stay out of the sanitized authoring reference. */
  readonly runtimeOnly?: boolean;
}

/** Identity, flags, or structured declarations whose owning mechanic validates their shape. */
export interface DataFieldSpec {
  readonly kind: 'data';
  /** A map of fixed grants keyed by canonical attribute names. */
  readonly attributes?: true;
}

export type FieldSpec = NumericFieldSpec | DataFieldSpec;

export type FieldSpecs = Readonly<Record<string, FieldSpec>>;

/** Accepts a declaration whose shape its owning mechanic validates. */
export const dataField: DataFieldSpec = Object.freeze({ kind: 'data' });

/** Declares a numeric field; defaults describe an unpatchable, nonnegative value. */
export function numberField(spec: Omit<NumericFieldSpec, 'kind'> = {}): NumericFieldSpec {
  return Object.freeze({ kind: 'number', ...spec });
}

/**
 * Optional numeric properties for a profession skill interface, derived from its declarations so the field name and
 * type are authored once. Dotted keys are patch leaves inside a declared group and type with their group.
 */
export type NumericSkillFields<T extends FieldSpecs> = {
  readonly [
    K in keyof T as K extends `${string}.${string}` ? never : T[K] extends NumericFieldSpec ? K : never
  ]?: number;
};

const FIELD_UNITS = new Set<FieldUnit>([
  'seconds',
  'milliseconds',
  'probability',
  'fraction',
  'factor',
  'attribute',
  'percent'
]);
const FIELD_PATCH_TIERS = new Set(['primary', 'advanced']);

/**
 * Reject malformed declarations when a table is defined, before any catalog depends on it. Declarations may come from
 * untyped JavaScript data, so the shape is checked rather than trusted.
 */
function validateFieldSpec(field: string, candidate: unknown, owner: string): void {
  if (!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?$/.test(field))
    throw new TypeError(`${owner} declares invalid field name ${field}.`);

  const kind = candidate && typeof candidate === 'object' ? (candidate as { readonly kind?: unknown }).kind : undefined;

  if (kind === 'data') {
    if (field.includes('.')) throw new TypeError(`${owner} field ${field} must be numeric.`);

    return;
  }

  if (kind !== 'number') throw new TypeError(`${owner} field ${field} has an invalid kind.`);

  const spec = candidate as NumericFieldSpec;

  const minimum = spec.minimum ?? 0;
  const maximum = spec.maximum ?? Infinity;

  if (Number.isNaN(minimum) || Number.isNaN(maximum) || minimum > maximum || minimum === Infinity)
    throw new TypeError(`${owner} field ${field} has invalid bounds.`);

  if (spec.unit !== undefined && !FIELD_UNITS.has(spec.unit))
    throw new TypeError(`${owner} field ${field} has an invalid unit.`);

  if (spec.patch !== undefined && !FIELD_PATCH_TIERS.has(spec.patch))
    throw new TypeError(`${owner} field ${field} has an invalid patch tier.`);

  if (spec.patch && spec.runtimeOnly)
    throw new TypeError(`${owner} field ${field} cannot be both patchable and runtime-only.`);
}

/** Freezes one owner's declarations after checking their names, kinds, bounds, units, and patch tiers. */
export function defineFields<const T extends FieldSpecs>(specs: T, owner = 'Field table'): T {
  for (const [field, spec] of Object.entries(specs)) validateFieldSpec(field, spec, owner);

  return Object.freeze({ ...specs });
}

/** Combines declaration tables, giving each field exactly one owner. */
export function combineFields(
  tables: readonly { readonly owner: string; readonly fields: FieldSpecs | undefined }[]
): FieldSpecs {
  const combined: Record<string, FieldSpec> = {};
  const owners = new Map<string, string>();
  for (const { owner, fields } of tables) {
    for (const [field, spec] of Object.entries(fields ?? {})) {
      validateFieldSpec(field, spec, owner);
      const prior = owners.get(field);

      if (prior) throw new TypeError(`Duplicate field ${field} in ${prior} and ${owner}.`);

      owners.set(field, owner);
      combined[field] = spec;
    }
  }

  return Object.freeze(combined);
}

/** A dotted patch leaf requires its group, so a nested value cannot be accepted while its container is rejected. */
export function assertFieldGroups(fields: FieldSpecs): void {
  for (const field of Object.keys(fields)) {
    const group = field.split('.')[0];

    if (group !== field && fields[group]?.kind !== 'data')
      throw new TypeError(`Field ${field} requires its group ${group} to be declared.`);
  }
}

/** Reuse compiled paths during catalog validation while preserving own-property checks for grouped values. */
function fieldValueAtPath(owner: unknown, path: readonly string[]): unknown {
  let value = owner;
  for (const segment of path) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, segment)) return undefined;

    value = (value as Readonly<Record<string, unknown>>)[segment];
  }

  return value;
}

interface NumericFieldValidation {
  readonly field: string;
  readonly path: readonly string[];
  readonly minimum: number;
  readonly maximum: number;
}

const numericFieldValidations = new WeakMap<FieldSpecs, readonly NumericFieldValidation[]>();

/** Compile the immutable registry once so each owner only reads numeric values and checks their bounds. */
function numericValidationFields(fields: FieldSpecs): readonly NumericFieldValidation[] {
  let validations = numericFieldValidations.get(fields);

  if (!validations) {
    validations = Object.entries(fields).flatMap(([field, spec]) =>
      spec.kind === 'number'
        ? [{ field, path: field.split('.'), minimum: spec.minimum ?? 0, maximum: spec.maximum ?? Infinity }]
        : []
    );
    numericFieldValidations.set(fields, validations);
  }

  return validations;
}

/** Every declared numeric value must be finite and inside its inclusive bounds; absent values stay unchecked. */
export function validateFieldValues(owner: object, fields: FieldSpecs, label: string): void {
  for (const { field, path, minimum, maximum } of numericValidationFields(fields)) {
    const value = fieldValueAtPath(owner, path);

    if (value === undefined) continue;

    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
      throw new TypeError(
        `${label} field=${field} expected=finite number in [${minimum}, ${maximum === Infinity ? 'Infinity' : maximum}].`
      );
  }
}

/** Patchable numeric fields, in declaration order, with their editor tier. */
export function patchableNumericFields(fields: FieldSpecs): readonly (readonly [string, NumericFieldSpec])[] {
  return Object.entries(fields).filter(
    (entry): entry is [string, NumericFieldSpec] => entry[1].kind === 'number' && entry[1].patch !== undefined
  );
}
