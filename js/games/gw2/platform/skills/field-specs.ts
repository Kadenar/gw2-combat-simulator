/**
 * Declares which fields a skill may carry. The platform owns the vocabulary its own code reads; each profession
 * module contributes the fields that only its code reads. One record per field drives catalog validation, the patch
 * allowlist, and authoring labels, so no other registry repeats the field name.
 */

/** Units select the editor suffix; stored values keep their declared unit. */
export type SkillFieldUnit = 'seconds' | 'milliseconds' | 'probability';

/** Numeric tuning or timing whose bounds are enforced on every authored and patched catalog. */
export interface NumericSkillFieldSpec {
  readonly kind: 'number';
  /** Author-facing name; when omitted, labels split the camel-case key. */
  readonly label?: string;
  readonly unit?: SkillFieldUnit;
  /** Inclusive lower bound; omitted means zero, because skill tuning is nonnegative unless declared otherwise. */
  readonly minimum?: number;
  /** Inclusive upper bound. */
  readonly maximum?: number;
  /** Patches may edit the value; advanced fields sit behind the editor's calibration disclosure. */
  readonly patch?: 'primary' | 'advanced';
  /** Timing internals stay out of the sanitized authoring reference. */
  readonly runtimeOnly?: boolean;
}

/** Identity, flags, or structured declarations whose owning mechanic validates their shape. */
export interface DataSkillFieldSpec {
  readonly kind: 'data';
}

export type SkillFieldSpec = NumericSkillFieldSpec | DataSkillFieldSpec;

export type SkillFieldSpecs = Readonly<Record<string, SkillFieldSpec>>;

/** Accepts a declaration whose shape its owning mechanic validates. */
export const dataField: DataSkillFieldSpec = Object.freeze({ kind: 'data' });

/** Declares a numeric skill field; defaults describe an unpatchable, nonnegative value. */
export function numberField(spec: Omit<NumericSkillFieldSpec, 'kind'> = {}): NumericSkillFieldSpec {
  return Object.freeze({ kind: 'number', ...spec });
}

/**
 * Optional numeric properties for a profession skill interface, derived from its declarations so the field name and
 * type are authored once. Dotted keys are patch leaves inside a declared group and type with their group.
 */
export type NumericSkillFields<T extends SkillFieldSpecs> = {
  readonly [
    K in keyof T as K extends `${string}.${string}` ? never : T[K] extends NumericSkillFieldSpec ? K : never
  ]?: number;
};

const SKILL_FIELD_UNITS = new Set<SkillFieldUnit>(['seconds', 'milliseconds', 'probability']);
const SKILL_FIELD_PATCH_TIERS = new Set(['primary', 'advanced']);

/**
 * Reject malformed declarations when a table is defined, before any catalog depends on it. Declarations may come from
 * untyped JavaScript data, so the shape is checked rather than trusted.
 */
function validateSkillFieldSpec(field: string, candidate: unknown, owner: string): void {
  if (!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?$/.test(field))
    throw new TypeError(`${owner} declares invalid skill field name ${field}.`);

  const kind = candidate && typeof candidate === 'object' ? (candidate as { readonly kind?: unknown }).kind : undefined;

  if (kind === 'data') {
    if (field.includes('.')) throw new TypeError(`${owner} skill field ${field} must be numeric.`);

    return;
  }

  if (kind !== 'number') throw new TypeError(`${owner} skill field ${field} has an invalid kind.`);

  const spec = candidate as NumericSkillFieldSpec;

  const minimum = spec.minimum ?? 0;
  const maximum = spec.maximum ?? Infinity;

  if (Number.isNaN(minimum) || Number.isNaN(maximum) || minimum > maximum || minimum === Infinity)
    throw new TypeError(`${owner} skill field ${field} has invalid bounds.`);

  if (spec.unit !== undefined && !SKILL_FIELD_UNITS.has(spec.unit))
    throw new TypeError(`${owner} skill field ${field} has an invalid unit.`);

  if (spec.patch !== undefined && !SKILL_FIELD_PATCH_TIERS.has(spec.patch))
    throw new TypeError(`${owner} skill field ${field} has an invalid patch tier.`);

  if (spec.patch && spec.runtimeOnly)
    throw new TypeError(`${owner} skill field ${field} cannot be both patchable and runtime-only.`);
}

/** Freezes one owner's declarations after checking their names, kinds, bounds, units, and patch tiers. */
export function defineSkillFields<const T extends SkillFieldSpecs>(specs: T, owner = 'Skill field table'): T {
  for (const [field, spec] of Object.entries(specs)) validateSkillFieldSpec(field, spec, owner);

  return Object.freeze({ ...specs });
}

/** Combines declaration tables, giving each field exactly one owner. */
export function combineSkillFields(
  tables: readonly { readonly owner: string; readonly fields: SkillFieldSpecs | undefined }[]
): SkillFieldSpecs {
  const combined: Record<string, SkillFieldSpec> = {};
  const owners = new Map<string, string>();
  for (const { owner, fields } of tables) {
    for (const [field, spec] of Object.entries(fields ?? {})) {
      validateSkillFieldSpec(field, spec, owner);
      const prior = owners.get(field);

      if (prior) throw new TypeError(`Duplicate skill field ${field} in ${prior} and ${owner}.`);

      owners.set(field, owner);
      combined[field] = spec;
    }
  }

  return Object.freeze(combined);
}

/** A dotted patch leaf requires its group, so a nested value cannot be accepted while its container is rejected. */
export function assertSkillFieldGroups(fields: SkillFieldSpecs): void {
  for (const field of Object.keys(fields)) {
    const group = field.split('.')[0];

    if (group !== field && fields[group]?.kind !== 'data')
      throw new TypeError(`Skill field ${field} requires its group ${group} to be declared.`);
  }
}

/** Reuse compiled paths during catalog validation while preserving own-property checks for grouped values. */
function skillFieldValueAtPath(owner: unknown, path: readonly string[]): unknown {
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

const numericFieldValidations = new WeakMap<SkillFieldSpecs, readonly NumericFieldValidation[]>();

/** Compile the immutable registry once so each skill only reads numeric values and checks their bounds. */
function numericValidationFields(fields: SkillFieldSpecs): readonly NumericFieldValidation[] {
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
export function validateSkillFieldValues(skill: object, fields: SkillFieldSpecs, label: string): void {
  for (const { field, path, minimum, maximum } of numericValidationFields(fields)) {
    const value = skillFieldValueAtPath(skill, path);

    if (value === undefined) continue;

    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
      throw new TypeError(
        `${label} field=${field} expected=finite number in [${minimum}, ${maximum === Infinity ? 'Infinity' : maximum}].`
      );
  }
}

/** Patchable numeric fields, in declaration order, with their editor tier. */
export function patchableSkillFields(fields: SkillFieldSpecs): readonly (readonly [string, NumericSkillFieldSpec])[] {
  return Object.entries(fields).filter(
    (entry): entry is [string, NumericSkillFieldSpec] => entry[1].kind === 'number' && entry[1].patch !== undefined
  );
}
