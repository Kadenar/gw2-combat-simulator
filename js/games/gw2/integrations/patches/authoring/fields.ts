/** Owns editable-field metadata and sanitized authoring references without applying patches. */
import { deepFreeze } from '#gw2/integrations/patches/authoring/immutable.js';
import { hasActionEffects } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { patchableNumericFields, type FieldSpecs } from '#gw2/platform/skills/field-specs.js';
import type { BalanceProfile, Skill } from '#gw2/platform/skills/types.js';

// Effect and profile timing internals stay out of authoring references; skill fields declare their own visibility.
const EFFECT_RUNTIME_ONLY_NUMERIC_FIELDS = [
  'alternateEvery',
  'atMs',
  'initialDelay',
  'interruptCommitMs',
  'quicknessCastMultiplier'
];

/** Names hidden at every nesting level of an authoring reference, including the skill fields declared runtime-only. */
function runtimeOnlyAuthoringFields(fields: FieldSpecs): ReadonlySet<string> {
  return new Set([
    ...EFFECT_RUNTIME_ONLY_NUMERIC_FIELDS,
    ...Object.entries(fields).flatMap(([field, spec]) => (spec.kind === 'number' && spec.runtimeOnly ? [field] : []))
  ]);
}

const EFFECT_RUNTIME_ONLY_AUTHORING_FIELDS = new Set(EFFECT_RUNTIME_ONLY_NUMERIC_FIELDS);

export const PATCHABLE_EFFECT_NUMERIC_FIELDS = Object.freeze([
  'allyStacks',
  'coefficient',
  'hits',
  'stacks',
  'duration',
  'maximumDuration',
  'applications',
  'intervalMs',
  'flatDamage',
  'flatStrikeBase',
  'flatStrikePowerCoeff',
  'durationPerAffinity',
  'durationReductionPerAffinity',
  'damageIncreasePerStack',
  'damagePerCoefficient'
] as const);

/** Flat packets use their own formula, including defaults inherited by ticks; ordinary coefficients cannot tune it. */
export function effectNumericFieldIsPatchable(
  field: string,
  effect: Readonly<Record<string, unknown>>,
  parent?: Readonly<Record<string, unknown>>
): boolean {
  return (
    PATCHABLE_EFFECT_NUMERIC_FIELDS.some((candidate) => candidate === field) &&
    !(
      field === 'coefficient' &&
      [effect, parent].some(
        (source) =>
          source && ['flatDamage', 'flatStrikeBase', 'flatStrikePowerCoeff'].some((key) => Number.isFinite(source[key]))
      )
    )
  );
}

const BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS = new Set<string>(PATCHABLE_EFFECT_NUMERIC_FIELDS);
const ADVANCED_BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS = new Set([
  'applications',
  'damagePerCoefficient',
  'flatDamage',
  'flatStrikeBase',
  'flatStrikePowerCoeff',
  'intervalMs'
]);

export type BalanceProfileAuthoringTier = 'primary' | 'advanced';

/** Separates common patch-note values from specialist calibration controls in the profile editor. */
export function balanceProfileNumericFieldTier(field: string, fields: FieldSpecs): BalanceProfileAuthoringTier | null {
  const spec = fields[field];
  return spec?.kind === 'number' ? (spec.patch ?? null) : null;
}

/** Treats one-hit declarations as structural while keeping changed hit counts visible as primary balance values. */
export function balanceProfileEffectNumericFieldTier(field: string, value: number): BalanceProfileAuthoringTier | null {
  if (!BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS.has(field)) return null;

  return ADVANCED_BALANCE_PROFILE_EFFECT_NUMERIC_FIELDS.has(field) || (field === 'hits' && value === 1)
    ? 'advanced'
    : 'primary';
}

/** Detects whether an effect or nested tick exposes at least one approved profile control. */
function effectHasAuthorableProfileValue(effect: Readonly<SkillEffect>, parent?: Readonly<SkillEffect>): boolean {
  for (const [field, value] of Object.entries(effect)) {
    if (typeof value === 'number' && effectNumericFieldIsPatchable(field, effect, parent)) return true;
  }

  return Array.isArray(effect.ticks) && effect.ticks.some((tick) => effectHasAuthorableProfileValue(tick, effect));
}

/** Reads a nested numeric candidate without treating missing path segments as errors. */
function valueAtPath(root: unknown, path: string): unknown {
  let value = root;
  for (const segment of path.split('.')) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const record = value as Readonly<Record<string, unknown>>;

    if (!Object.hasOwn(record, segment)) return undefined;

    value = record[segment];
  }

  return value;
}

/** Returns the skill's numeric values whose declarations in the selected catalog permit patch edits. */
export function skillPatchableNumericFields(
  skill: Readonly<Skill>,
  fields: FieldSpecs
): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(
      patchableNumericFields(fields).flatMap(([field]) => {
        const value = valueAtPath(skill, field);
        return typeof value === 'number' ? [[field, value]] : [];
      })
    )
  );
}

/** Runtime predicates and activation declarations stay in the executable catalog, never in editor JSON. */
function withoutRuntimeOnlyAuthoringFields(
  value: unknown,
  runtimeOnly: ReadonlySet<string>,
  parent?: Readonly<Record<string, unknown>>
): unknown {
  if (Array.isArray(value)) return value.map((entry) => withoutRuntimeOnlyAuthoringFields(entry, runtimeOnly, parent));

  if (typeof value === 'function') return undefined;

  if (!value || typeof value !== 'object') return structuredClone(value);

  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>).flatMap(([field, nested]) =>
      // Cast grants and inline payloads remain editable; executable predicates stay private.
      field === 'sideEffects' && Array.isArray(nested)
        ? nested.some((rule) => (rule.do?.type === 'resourceGrant' && rule.do?.id) || hasActionEffects(rule.do))
          ? [
              [
                field,
                nested
                  .filter((rule) => (rule.do?.type === 'resourceGrant' && rule.do?.id) || hasActionEffects(rule.do))
                  .map((rule) => withoutRuntimeOnlyAuthoringFields(rule, runtimeOnly))
              ]
            ]
          : []
        : (field === 'coefficient' &&
              !effectNumericFieldIsPatchable(field, value as Record<string, unknown>, parent)) ||
            typeof nested === 'function' ||
            runtimeOnly.has(field) ||
            ['effectVariants', 'when'].includes(field)
          ? []
          : [
              [
                field,
                withoutRuntimeOnlyAuthoringFields(
                  nested,
                  runtimeOnly,
                  field === 'ticks' ? (value as Record<string, unknown>) : undefined
                )
              ]
            ]
    )
  );
}

/**
 * Builds a skill reference for the editor while retaining complete timing data in the runtime catalog. The selected
 * catalog's field table decides which skill fields are runtime-only.
 */
export function skillAuthoringReference(skill: Readonly<Skill>, fields: FieldSpecs): Readonly<Skill> {
  return deepFreeze(withoutRuntimeOnlyAuthoringFields(skill, runtimeOnlyAuthoringFields(fields)) as Skill);
}

/** Returns the numeric balance-profile fields supported by patch authoring. */
export function balanceProfilePatchableNumericFields(
  profile: Readonly<BalanceProfile>,
  fields: FieldSpecs
): Readonly<Record<string, number>> {
  return Object.freeze(
    Object.fromEntries(
      patchableNumericFields(fields).flatMap(([field]) => {
        const value = valueAtPath(profile, field);
        return typeof value === 'number' ? [[field, value]] : [];
      })
    )
  );
}

/** Keeps runtime-only or empty profiles out of the authoring payload without removing them from the catalog. */
export function balanceProfileHasAuthorableControls(profile: Readonly<BalanceProfile>, fields: FieldSpecs): boolean {
  return (
    Object.keys(balanceProfilePatchableNumericFields(profile, fields)).length > 0 ||
    (profile.effects || []).some((effect) => effectHasAuthorableProfileValue(effect))
  );
}

/** Copies effect identity and approved numeric controls while dropping runtime-only timing metadata. */
function balanceProfileEffectAuthoringReference(
  record: Readonly<Record<string, unknown>>,
  parent?: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).flatMap(([field, value]) => {
      if (field === 'when') return [];

      if (field === 'ticks' && Array.isArray(value)) {
        return [
          [
            field,
            value.map((tick) =>
              balanceProfileEffectAuthoringReference(tick as Readonly<Record<string, unknown>>, record)
            )
          ]
        ];
      }

      if (typeof value === 'number' && !effectNumericFieldIsPatchable(field, record, parent)) return [];

      return [[field, withoutRuntimeOnlyAuthoringFields(value, EFFECT_RUNTIME_ONLY_AUTHORING_FIELDS)]];
    })
  );
}

/** Builds the sanitized profile reference sent to authoring without leaking simulator-only fields. */
export function balanceProfileAuthoringReference(
  profile: Readonly<BalanceProfile>,
  fields: FieldSpecs
): Readonly<BalanceProfile> {
  // Keep grouped values nested in reference JSON; only patch controls use dotted paths.
  const values: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(balanceProfilePatchableNumericFields(profile, fields))) {
    const [group, leaf] = path.split('.');

    if (leaf) {
      const nested = (values[group!] ??= {}) as Record<string, number>;
      nested[leaf] = value;
    } else values[group!] = value;
  }

  return deepFreeze({
    id: profile.id,
    name: profile.name,
    ...values,
    effects: (profile.effects || []).map((effect) =>
      balanceProfileEffectAuthoringReference(effect as unknown as Readonly<Record<string, unknown>>)
    )
  } as unknown as BalanceProfile);
}
