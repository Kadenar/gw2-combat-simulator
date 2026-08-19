import { applyAdditiveDamageBucket } from './damage-modifier-buckets.js';

import type {
  Gw2AttributeModifierHook,
  Gw2DamageBucketPolicies,
  Gw2DamageBucketPolicy,
  Gw2DamageModifierTarget,
  Gw2ModifierContext,
  Gw2ModifierHook,
  Gw2ModifierHooks,
  Gw2ModifierNumericResolver,
  Gw2ModifierOperation,
  Gw2ModifierRule,
  Gw2ModifierTarget,
  Gw2NormalizedModifierRule,
  Gw2ResolvedStats
} from './types.js';

interface NormalizeResolverOptions {
  readonly positive?: boolean;
}

interface CreateModifierHooksOptions {
  readonly rules?: readonly Gw2ModifierRule[];
  readonly damageBuckets?: Gw2DamageBucketPolicies;
}

/**
 * Compiles declarative GW2 combat modifiers into profession hooks.
 *
 * Rule declarations are validated and indexed once when
 * `createModifierHooks` is called. Predicates and functional numeric values
 * are evaluated later for each hook invocation because they may depend on the
 * current event, timeline, weapon set, or profession state.
 *
 * Scalar targets apply `add` and `multiply` sequentially. Strike and condition
 * damage instead collect `damage-additive` rules into GW2's shared outgoing
 * damage bucket, then apply true `multiply` rules after that bucket.
 *
 * @module platform/gw2/modifier-rules
 */

/**
 * Supported rule targets. Scalar combat targets map one-to-one to profession
 * hooks, following the existing declarative modifier pattern. Attribute
 * targets extend that pattern to individual fields processed together by the
 * `modifyAttributes` hook returned by `createModifierHooks`.
 *
 * At runtime, `modifyAttributes` resolves attributes first. Critical chance
 * and critical damage are then derived from the resulting precision and
 * ferocity, respectively, before `modifyCriticalChance` and
 * `modifyCriticalDamage` apply their direct adjustments.
 *
 * - `criticalChance` → `modifyCriticalChance`
 * - `criticalDamage` → `modifyCriticalDamage`
 * - `strikeDamage` → `modifyStrikeDamage`
 * - `conditionDamage` → `modifyConditionDamage`
 * - `conditionDuration` → `modifyConditionDuration`
 * - `attribute*` → the corresponding resolved-stat field through `modifyAttributes`
 */
export const MODIFIER_TARGET = Object.freeze({
  CRITICAL_CHANCE: 'criticalChance',
  CRITICAL_DAMAGE: 'criticalDamage',
  STRIKE_DAMAGE: 'strikeDamage',
  CONDITION_DAMAGE: 'conditionDamage',
  CONDITION_DURATION: 'conditionDuration',
  ATTRIBUTE_POWER: 'attributePower',
  ATTRIBUTE_PRECISION: 'attributePrecision',
  ATTRIBUTE_FEROCITY: 'attributeFerocity',
  ATTRIBUTE_CONDITION_DAMAGE: 'attributeConditionDamage',
  ATTRIBUTE_HEALING_POWER: 'attributeHealingPower',
  ATTRIBUTE_VITALITY: 'attributeVitality'
});

const TARGETS: ReadonlySet<Gw2ModifierTarget> = new Set(Object.values(MODIFIER_TARGET));
const DAMAGE_TARGETS: ReadonlySet<Gw2DamageModifierTarget> = new Set([
  MODIFIER_TARGET.STRIKE_DAMAGE,
  MODIFIER_TARGET.CONDITION_DAMAGE
]);
const ATTRIBUTE_KEY_BY_TARGET = Object.freeze({
  [MODIFIER_TARGET.ATTRIBUTE_POWER]: 'power',
  [MODIFIER_TARGET.ATTRIBUTE_PRECISION]: 'precision',
  [MODIFIER_TARGET.ATTRIBUTE_FEROCITY]: 'ferocity',
  [MODIFIER_TARGET.ATTRIBUTE_CONDITION_DAMAGE]: 'conditionDamage',
  [MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER]: 'healingPower',
  [MODIFIER_TARGET.ATTRIBUTE_VITALITY]: 'vitality'
} as const);
const ATTRIBUTE_TARGETS: ReadonlySet<Gw2ModifierTarget> = new Set(
  Object.keys(ATTRIBUTE_KEY_BY_TARGET) as Gw2ModifierTarget[]
);
const OPERATIONS: ReadonlySet<Gw2ModifierOperation> = new Set(['add', 'damage-additive', 'multiply']);
const HOOK_BY_TARGET: Readonly<
  Partial<Record<Gw2ModifierTarget, Exclude<keyof Gw2ModifierHooks, 'modifyAttributes'>>>
> = Object.freeze({
  [MODIFIER_TARGET.CRITICAL_CHANCE]: 'modifyCriticalChance',
  [MODIFIER_TARGET.CRITICAL_DAMAGE]: 'modifyCriticalDamage',
  [MODIFIER_TARGET.STRIKE_DAMAGE]: 'modifyStrikeDamage',
  [MODIFIER_TARGET.CONDITION_DAMAGE]: 'modifyConditionDamage',
  [MODIFIER_TARGET.CONDITION_DURATION]: 'modifyConditionDuration'
});
const EMPTY_MODIFIER_PARAMETERS: Readonly<Record<string, number>> = Object.freeze({});

/**
 * Creates an error tied to a declaration's stable id so invalid profession
 * data identifies the responsible rule.
 *
 * @param {string} id Rule id, or a generated missing-id description.
 * @param {string} message Validation failure.
 * @returns {TypeError}
 */
function ruleError(id: string, message: string): TypeError {
  return new TypeError(`Modifier rule "${id}": ${message}`);
}

/**
 * Validates a static numeric value or retains a dynamic value resolver.
 * Dynamic results are validated by `resolveNumeric` when the hook runs.
 *
 * @param {Gw2ModifierRule} rule Rule being normalized.
 * @param {"amount"|"factor"} field Numeric field required by the operation.
 * @param {{positive?: boolean}} [options] Whether the value must be above zero.
 * @returns {number|Gw2ModifierNumericResolver}
 */
function normalizeResolver(
  rule: Gw2ModifierRule,
  field: 'amount' | 'factor',
  { positive = false }: NormalizeResolverOptions = {}
): number | Gw2ModifierNumericResolver {
  if (!(field in rule)) {
    throw ruleError(rule.id, `${field} is required.`);
  }

  const resolver = rule[field];
  // Numeric callbacks are retained and validated again when invoked because
  // their result can depend on timestamp-specific combat context.
  if (typeof resolver === 'function') return resolver;
  if (typeof resolver !== 'number' || !Number.isFinite(resolver) || (positive && !(resolver > 0))) {
    throw ruleError(rule.id, `${field} must be ${positive ? 'a positive ' : 'a '}finite number or function.`);
  }

  return resolver;
}

function normalizeParameters(rule: Gw2ModifierRule): Readonly<Record<string, number>> {
  if (!Object.hasOwn(rule, 'parameters')) return EMPTY_MODIFIER_PARAMETERS;
  if (!rule.parameters || typeof rule.parameters !== 'object' || Array.isArray(rule.parameters)) {
    throw ruleError(rule.id, 'parameters must be an object.');
  }

  const parameters: Record<string, number> = {};
  for (const [name, value] of Object.entries(rule.parameters)) {
    if (!name.trim()) {
      throw ruleError(rule.id, 'parameter names must not be empty.');
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw ruleError(rule.id, `parameter ${name} must be a finite number.`);
    }

    parameters[name] = value;
  }

  return Object.freeze(parameters);
}

/**
 * Converts a scalar or array target declaration into a validated, deduplicated
 * frozen array. Original target order is preserved.
 *
 * @param {Gw2ModifierRule} rule Rule with a normalized id.
 * @returns {readonly Gw2ModifierTarget[]}
 */
function normalizeTargets(rule: Gw2ModifierRule): readonly Gw2ModifierTarget[] {
  const declared = Array.isArray(rule.target) ? rule.target : [rule.target];
  if (!declared.length) {
    throw ruleError(rule.id, 'target must not be an empty array.');
  }

  const targets: Gw2ModifierTarget[] = [];
  for (const target of declared) {
    if (!TARGETS.has(target)) {
      throw ruleError(rule.id, `unknown target "${String(target)}".`);
    }

    if (!targets.includes(target)) targets.push(target);
  }

  return Object.freeze(targets);
}

/**
 * Validates and freezes one rule declaration.
 *
 * `add` is restricted to scalar targets. `damage-additive` is restricted to
 * strike and condition damage so those bonuses cannot bypass GW2's shared
 * additive damage bucket. `multiply` is valid for every target.
 *
 * @param {Gw2ModifierRule} rule Raw profession rule.
 * @param {number} declarationIndex Original position used as the final sort tie-breaker.
 * @returns {Readonly<Gw2NormalizedModifierRule>}
 */
function normalizeRule(rule: Gw2ModifierRule, declarationIndex: number): Readonly<Gw2NormalizedModifierRule> {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    throw ruleError(`<missing at index ${declarationIndex}>`, 'must be an object.');
  }

  const id = typeof rule.id === 'string' ? rule.id.trim() : '';
  if (!id) {
    throw ruleError(`<missing at index ${declarationIndex}>`, 'id is required.');
  }

  const label = typeof rule.label === 'string' ? rule.label.trim() : '';
  if (Object.hasOwn(rule, 'label') && !label) {
    throw ruleError(id, 'label must be a non-empty string.');
  }

  const operation = rule.operation;
  if (typeof operation !== 'string' || !OPERATIONS.has(operation)) {
    throw ruleError(id, `unknown operation "${String(operation || '')}".`);
  }

  const targets = normalizeTargets({ ...rule, id });
  if (Object.hasOwn(rule, 'when') && typeof rule.when !== 'function') {
    throw ruleError(id, 'when must be a function.');
  }

  const order = Object.hasOwn(rule, 'order') ? rule.order : 0;
  if (typeof order !== 'number' || !Number.isFinite(order)) {
    throw ruleError(id, 'order must be a finite number.');
  }

  for (const target of targets) {
    const damageTarget = target === MODIFIER_TARGET.STRIKE_DAMAGE || target === MODIFIER_TARGET.CONDITION_DAMAGE;
    // Damage additions use GW2's shared additive bucket. Plain scalar addition
    // is reserved for chance, multiplier, and duration values.
    if (operation === 'add' && damageTarget) {
      throw ruleError(id, `add is not supported for ${target}.`);
    }

    if (operation === 'damage-additive' && !damageTarget) {
      throw ruleError(id, `damage-additive is not supported for ${target}.`);
    }
  }

  const normalized = {
    id,
    label: label || null,
    targets,
    operation,
    parameters: normalizeParameters({ ...rule, id }),
    when: rule.when || null,
    order,
    declarationIndex
  };
  const field = operation === 'multiply' ? 'factor' : 'amount';
  const resolver = normalizeResolver({ ...rule, id }, field, field === 'factor' ? { positive: true } : undefined);
  if (Object.keys(normalized.parameters).length && typeof resolver !== 'function') {
    throw ruleError(id, 'parameters require a resolver-backed numeric value.');
  }

  return Object.freeze({
    ...normalized,
    [field]: resolver
  }) as Readonly<Gw2NormalizedModifierRule>;
}

/**
 * Normalizes a complete rule list and enforces globally unique rule ids.
 *
 * @param {readonly Gw2ModifierRule[]} rules Raw rule declarations.
 * @returns {readonly Readonly<Gw2NormalizedModifierRule>[]}
 */
function normalizeRules(rules: readonly Gw2ModifierRule[]): readonly Readonly<Gw2NormalizedModifierRule>[] {
  if (!Array.isArray(rules)) {
    throw new TypeError('Modifier rules must be an array.');
  }

  const ids = new Set<string>();
  const normalized = rules.map((rule, index) => {
    const result = normalizeRule(rule, index);
    if (ids.has(result.id)) {
      throw ruleError(result.id, 'id must be unique.');
    }

    ids.add(result.id);
    return result;
  });
  return Object.freeze(normalized);
}

/**
 * Normalizes per-damage-target sigil participation policies.
 *
 * Both damage targets include the active sigil in the additive bucket by
 * default. A boolean disables it permanently; a callback can decide from the
 * current hook context, such as excluding player sigils from summon damage.
 *
 * @param {Gw2DamageBucketPolicies} damageBuckets
 * @returns {Readonly<Record<Gw2DamageModifierTarget, Gw2DamageBucketPolicy>>}
 */
function normalizeBucketPolicies(
  damageBuckets: Gw2DamageBucketPolicies
): Readonly<Record<Gw2DamageModifierTarget, Gw2DamageBucketPolicy>> {
  if (damageBuckets == null || typeof damageBuckets !== 'object' || Array.isArray(damageBuckets)) {
    throw new TypeError('Modifier damageBuckets must be an object.');
  }

  const policies: Partial<Record<Gw2DamageModifierTarget, Gw2DamageBucketPolicy>> = {};
  for (const target of DAMAGE_TARGETS) {
    if (!Object.hasOwn(damageBuckets, target)) {
      // Sigil bonuses participate in the common bucket unless a profession
      // explicitly opts out for that damage type.
      policies[target] = Object.freeze({ includeSigil: true });
      continue;
    }

    const declared = damageBuckets[target];
    if (declared == null || typeof declared !== 'object' || Array.isArray(declared)) {
      throw new TypeError(`Modifier bucket policy "${target}" must be an object.`);
    }

    const includeSigil = Object.hasOwn(declared, 'includeSigil') ? declared.includeSigil : true;
    if (typeof includeSigil !== 'boolean' && typeof includeSigil !== 'function') {
      throw new TypeError(`Modifier bucket policy "${target}" has an unsupported includeSigil value.`);
    }

    policies[target] = Object.freeze({ includeSigil });
  }

  for (const target of Object.keys(damageBuckets)) {
    if (!DAMAGE_TARGETS.has(target as Gw2DamageModifierTarget)) {
      throw new TypeError(`Modifier bucket policy has an unsupported target "${target}".`);
    }
  }

  return Object.freeze(policies) as Readonly<Record<Gw2DamageModifierTarget, Gw2DamageBucketPolicy>>;
}

/**
 * Resolves and validates an amount or factor at hook-execution time.
 * Functional values receive both the current context and active rule target.
 *
 * @param {Readonly<Gw2NormalizedModifierRule>} rule
 * @param {"amount"|"factor"} field Field to resolve.
 * @param {Gw2ModifierContext} context
 * @param {Gw2ModifierTarget} target
 * @returns {number}
 */
function resolveNumeric(
  rule: Readonly<Gw2NormalizedModifierRule>,
  field: 'amount' | 'factor',
  context: Gw2ModifierContext,
  target: Gw2ModifierTarget
): number {
  const declared = rule[field];
  const value = typeof declared === 'function' ? declared(context, target, rule.parameters) : declared;
  if (typeof value !== 'number' || !Number.isFinite(value) || (field === 'factor' && !(value > 0))) {
    throw ruleError(rule.id, `${field} must resolve to ${field === 'factor' ? 'a positive ' : 'a '}finite number.`);
  }

  return value;
}

/**
 * Builds an ordered hook for chance, critical multiplier, or duration values.
 * Operations run sequentially, so order matters: add-then-multiply can differ
 * from multiply-then-add. This layer does not clamp the final value.
 *
 * @param {readonly Readonly<Gw2NormalizedModifierRule>[]} rules
 * @param {Gw2ModifierTarget} target
 * @returns {Gw2ModifierHook}
 */
function createScalarHook(
  rules: readonly Readonly<Gw2NormalizedModifierRule>[],
  target: Gw2ModifierTarget
): Gw2ModifierHook {
  return Object.freeze((context: Gw2ModifierContext, initialValue: number): number => {
    let result = initialValue;
    // Scalar operations are sequential, so explicit rule order can make
    // add-then-multiply differ from multiply-then-add.
    for (const rule of rules) {
      if (rule.when && !rule.when(context)) continue;
      const previous = result;
      if (rule.operation === 'add') {
        result += resolveNumeric(rule, 'amount', context, target);
      } else {
        result *= resolveNumeric(rule, 'factor', context, target);
      }

      const contribution = result - previous;
      if (
        target === MODIFIER_TARGET.CRITICAL_CHANCE &&
        context.criticalChanceContributors &&
        Math.abs(contribution) > Number.EPSILON
      ) {
        const fallbackLabel = rule.id
          .split('.')
          .at(-1)!
          .replace(/-critical-chance$/, '')
          .split('-')
          .filter(Boolean)
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join(' ');
        context.criticalChanceContributors.push({
          id: rule.id,
          label: rule.label || fallbackLabel,
          amount: contribution
        });
      }
    }

    return result;
  });
}

function createAttributeHook(
  rulesByTarget: Readonly<Record<Gw2ModifierTarget, readonly Readonly<Gw2NormalizedModifierRule>[]>>
): Gw2AttributeModifierHook {
  return Object.freeze((context: Gw2ModifierContext, initialValue: Gw2ResolvedStats): Gw2ResolvedStats => {
    const result = { ...initialValue };
    for (const target of ATTRIBUTE_TARGETS) {
      const key = ATTRIBUTE_KEY_BY_TARGET[target as keyof typeof ATTRIBUTE_KEY_BY_TARGET] as keyof Gw2ResolvedStats;
      const hadKey = Object.hasOwn(result, key);
      let applied = false;
      let value = Number(result[key] || 0);
      for (const rule of rulesByTarget[target]) {
        if (rule.when && !rule.when(context)) continue;
        applied = true;
        value =
          rule.operation === 'add'
            ? value + resolveNumeric(rule, 'amount', context, target)
            : value * resolveNumeric(rule, 'factor', context, target);
      }

      if (hadKey || applied) {
        (result as Record<string, unknown>)[key] = value;
      }
    }

    return result;
  });
}

/**
 * Builds a strike- or condition-damage hook.
 *
 * Every active `damage-additive` amount is summed into one outgoing-damage
 * bucket. Every active `multiply` factor is multiplied separately and applied
 * after the rebuilt bucket, regardless of rule order.
 *
 * @param {readonly Readonly<Gw2NormalizedModifierRule>[]} rules
 * @param {Gw2DamageModifierTarget} target
 * @param {Gw2DamageBucketPolicy} policy
 * @returns {Gw2ModifierHook}
 */
function createDamageHook(
  rules: readonly Readonly<Gw2NormalizedModifierRule>[],
  target: Gw2DamageModifierTarget,
  policy: Gw2DamageBucketPolicy
): Gw2ModifierHook {
  const damageType = target === MODIFIER_TARGET.CONDITION_DAMAGE ? 'condition' : 'strike';
  return Object.freeze((context: Gw2ModifierContext, initialValue: number): number => {
    let additiveBonus = 0;
    let multiplicativeFactor = 1;
    // All damage-additive rules share one GW2 bucket; true multipliers are
    // combined separately and applied after that bucket.
    for (const rule of rules) {
      if (rule.when && !rule.when(context)) continue;
      if (rule.operation === 'damage-additive') {
        additiveBonus += resolveNumeric(rule, 'amount', context, target);
      } else {
        multiplicativeFactor *= resolveNumeric(rule, 'factor', context, target);
      }
    }

    const includeSigil = typeof policy.includeSigil === 'function' ? policy.includeSigil(context) : policy.includeSigil;
    // Dynamic policies support weapon-set or event-specific sigil inclusion.
    if (typeof includeSigil !== 'boolean') {
      throw new TypeError(`Modifier bucket policy "${target}" includeSigil must resolve to a boolean.`);
    }

    return (
      applyAdditiveDamageBucket(context, initialValue, {
        damageType,
        bonus: additiveBonus,
        includeSigil
      }) * multiplicativeFactor
    );
  });
}

/**
 * Compiles declarative profession scalar modifiers into the existing
 * profession hook contract.
 *
 * Rules declare a unique id, one or more targets, an operation, and either an
 * amount or factor. Optional `when(context)` gates a rule; `order` controls
 * deterministic execution before declaration order breaks ties.
 *
 * Rule schema:
 * - `id`: required unique, non-empty string.
 * - `target`: one `MODIFIER_TARGET` value or an array of values.
 * - `operation`: `add`, `damage-additive`, or `multiply`.
 * - `amount`: finite number or `(context, target) => number` for additive rules.
 * - `factor`: positive finite number or resolver for multiplicative rules.
 * - `parameters`: optional finite named inputs passed to a resolver as its third
 *   argument so preview overlays can patch dynamic formulas safely.
 * - `when`: optional `(context) => boolean` predicate.
 * - `order`: optional finite number; defaults to zero.
 *
 * `damageBuckets` accepts `strikeDamage` and `conditionDamage` entries. Their
 * `includeSigil` value may be a boolean or `(context) => boolean` and defaults
 * to true.
 *
 * @param {{
 *   rules?: readonly Gw2ModifierRule[],
 *   damageBuckets?: Gw2DamageBucketPolicies
 * }} [options]
 * @returns {Readonly<Gw2ModifierHooks>}
 * @throws {TypeError} If declarations are malformed or a dynamic value resolves
 * to an unsupported value.
 */
export function createModifierHooks({
  rules = [],
  damageBuckets = {}
}: CreateModifierHooksOptions = {}): Readonly<Gw2ModifierHooks> {
  const normalizedRules = normalizeRules(rules);
  const policies = normalizeBucketPolicies(damageBuckets);
  const rulesByTarget = Object.fromEntries([...TARGETS].map((target) => [target, []])) as unknown as Record<
    Gw2ModifierTarget,
    Gw2NormalizedModifierRule[]
  >;
  for (const rule of normalizedRules) {
    for (const target of rule.targets) rulesByTarget[target].push(rule);
  }

  for (const target of TARGETS) {
    // Stable declaration order is the final tie-breaker for equal rule order.
    rulesByTarget[target].sort(
      (left, right) => left.order - right.order || left.declarationIndex - right.declarationIndex
    );
    Object.freeze(rulesByTarget[target]);
  }

  Object.freeze(rulesByTarget);

  const hooks: {
    -readonly [K in keyof Gw2ModifierHooks]?: Gw2ModifierHooks[K];
  } = {};
  for (const target of TARGETS) {
    if (ATTRIBUTE_TARGETS.has(target)) continue;
    const hook = HOOK_BY_TARGET[target];
    if (!hook) continue;
    if (target === MODIFIER_TARGET.STRIKE_DAMAGE || target === MODIFIER_TARGET.CONDITION_DAMAGE) {
      hooks[hook] = createDamageHook(rulesByTarget[target], target, policies[target]);
    } else {
      hooks[hook] = createScalarHook(rulesByTarget[target], target);
    }
  }

  hooks.modifyAttributes = createAttributeHook(rulesByTarget);
  return Object.freeze(hooks) as Readonly<Gw2ModifierHooks>;
}
