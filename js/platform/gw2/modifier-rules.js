import {
  applyAdditiveDamageBucket,
} from "./damage-modifier-buckets.js";

// Public target names map directly to the profession hook contract compiled at
// the bottom of this module.
export const MODIFIER_TARGET = Object.freeze({
  CRITICAL_CHANCE: "criticalChance",
  CRITICAL_DAMAGE: "criticalDamage",
  STRIKE_DAMAGE: "strikeDamage",
  CONDITION_DAMAGE: "conditionDamage",
  CONDITION_DURATION: "conditionDuration",
});

const TARGETS = new Set(Object.values(MODIFIER_TARGET));
const DAMAGE_TARGETS = new Set([
  MODIFIER_TARGET.STRIKE_DAMAGE,
  MODIFIER_TARGET.CONDITION_DAMAGE,
]);
const OPERATIONS = new Set(["add", "damage-additive", "multiply"]);
const HOOK_BY_TARGET = Object.freeze({
  [MODIFIER_TARGET.CRITICAL_CHANCE]: "modifyCriticalChance",
  [MODIFIER_TARGET.CRITICAL_DAMAGE]: "modifyCriticalDamage",
  [MODIFIER_TARGET.STRIKE_DAMAGE]: "modifyStrikeDamage",
  [MODIFIER_TARGET.CONDITION_DAMAGE]: "modifyConditionDamage",
  [MODIFIER_TARGET.CONDITION_DURATION]: "modifyConditionDuration",
});

function ruleError(id, message) {
  return new TypeError(`Modifier rule "${id}": ${message}`);
}

function normalizeResolver(rule, field, {
  positive = false,
} = {}) {
  if (!(field in rule)) {
    throw ruleError(rule.id, `${field} is required.`);
  }
  const resolver = rule[field];
  // Numeric callbacks are retained and validated again when invoked because
  // their result can depend on timestamp-specific combat context.
  if (typeof resolver === "function") return resolver;
  if (
    typeof resolver !== "number"
    || !Number.isFinite(resolver)
    || (positive && !(resolver > 0))
  ) {
    throw ruleError(
      rule.id,
      `${field} must be ${positive ? "a positive " : "a "}finite number or function.`,
    );
  }
  return resolver;
}

function normalizeTargets(rule) {
  const declared = Array.isArray(rule.target)
    ? rule.target
    : [rule.target];
  if (!declared.length) {
    throw ruleError(rule.id, "target must not be an empty array.");
  }
  const targets = [];
  for (const target of declared) {
    if (!TARGETS.has(target)) {
      throw ruleError(rule.id, `unknown target "${String(target)}".`);
    }
    if (!targets.includes(target)) targets.push(target);
  }
  return Object.freeze(targets);
}

function normalizeRule(rule, declarationIndex) {
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    throw ruleError(`<missing at index ${declarationIndex}>`, "must be an object.");
  }
  const id = typeof rule.id === "string" ? rule.id.trim() : "";
  if (!id) {
    throw ruleError(`<missing at index ${declarationIndex}>`, "id is required.");
  }
  const operation = rule.operation;
  if (typeof operation !== "string" || !OPERATIONS.has(operation)) {
    throw ruleError(id, `unknown operation "${String(operation || "")}".`);
  }
  const targets = normalizeTargets({ ...rule, id });
  if (
    Object.hasOwn(rule, "when")
    && typeof rule.when !== "function"
  ) {
    throw ruleError(id, "when must be a function.");
  }
  const order = Object.hasOwn(rule, "order") ? rule.order : 0;
  if (typeof order !== "number" || !Number.isFinite(order)) {
    throw ruleError(id, "order must be a finite number.");
  }
  for (const target of targets) {
    const damageTarget = DAMAGE_TARGETS.has(target);
    // Damage additions use GW2's shared additive bucket. Plain scalar addition
    // is reserved for chance, multiplier, and duration values.
    if (operation === "add" && damageTarget) {
      throw ruleError(id, `add is not supported for ${target}.`);
    }
    if (operation === "damage-additive" && !damageTarget) {
      throw ruleError(
        id,
        `damage-additive is not supported for ${target}.`,
      );
    }
  }

  const normalized = {
    id,
    targets,
    operation,
    when: rule.when || null,
    order,
    declarationIndex,
  };
  if (operation === "multiply") {
    normalized.factor = normalizeResolver({ ...rule, id }, "factor", {
      positive: true,
    });
  } else {
    normalized.amount = normalizeResolver({ ...rule, id }, "amount");
  }
  return Object.freeze(normalized);
}

function normalizeRules(rules) {
  if (!Array.isArray(rules)) {
    throw new TypeError("Modifier rules must be an array.");
  }
  const ids = new Set();
  const normalized = rules.map((rule, index) => {
    const result = normalizeRule(rule, index);
    if (ids.has(result.id)) {
      throw ruleError(result.id, "id must be unique.");
    }
    ids.add(result.id);
    return result;
  });
  return Object.freeze(normalized);
}

function normalizeBucketPolicies(damageBuckets) {
  if (
    damageBuckets == null
    || typeof damageBuckets !== "object"
    || Array.isArray(damageBuckets)
  ) {
    throw new TypeError("Modifier damageBuckets must be an object.");
  }
  const policies = {};
  for (const target of DAMAGE_TARGETS) {
    if (!Object.hasOwn(damageBuckets, target)) {
      // Sigil bonuses participate in the common bucket unless a profession
      // explicitly opts out for that damage type.
      policies[target] = Object.freeze({ includeSigil: true });
      continue;
    }
    const declared = damageBuckets[target];
    if (
      declared == null
      || typeof declared !== "object"
      || Array.isArray(declared)
    ) {
      throw new TypeError(
        `Modifier bucket policy "${target}" must be an object.`,
      );
    }
    const includeSigil = Object.hasOwn(declared, "includeSigil")
      ? declared.includeSigil
      : true;
    if (
      typeof includeSigil !== "boolean"
      && typeof includeSigil !== "function"
    ) {
      throw new TypeError(
        `Modifier bucket policy "${target}" has an unsupported includeSigil value.`,
      );
    }
    policies[target] = Object.freeze({ includeSigil });
  }
  for (const target of Object.keys(damageBuckets)) {
    if (!DAMAGE_TARGETS.has(target)) {
      throw new TypeError(
        `Modifier bucket policy has an unsupported target "${target}".`,
      );
    }
  }
  return Object.freeze(policies);
}

function resolveNumeric(rule, field, context, target) {
  const declared = rule[field];
  const value = typeof declared === "function"
    ? declared(context, target)
    : declared;
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || (field === "factor" && !(value > 0))
  ) {
    throw ruleError(
      rule.id,
      `${field} must resolve to ${field === "factor" ? "a positive " : "a "}finite number.`,
    );
  }
  return value;
}

function createScalarHook(rules, target) {
  return Object.freeze((context, initialValue) => {
    let result = initialValue;
    // Scalar operations are sequential, so explicit rule order can make
    // add-then-multiply differ from multiply-then-add.
    for (const rule of rules) {
      if (rule.when && !rule.when(context)) continue;
      if (rule.operation === "add") {
        result += resolveNumeric(rule, "amount", context, target);
      } else {
        result *= resolveNumeric(rule, "factor", context, target);
      }
    }
    return result;
  });
}

function createDamageHook(rules, target, policy) {
  const damageType = target === MODIFIER_TARGET.CONDITION_DAMAGE
    ? "condition"
    : "strike";
  return Object.freeze((context, initialValue) => {
    let additiveBonus = 0;
    let multiplicativeFactor = 1;
    // All damage-additive rules share one GW2 bucket; true multipliers are
    // combined separately and applied after that bucket.
    for (const rule of rules) {
      if (rule.when && !rule.when(context)) continue;
      if (rule.operation === "damage-additive") {
        additiveBonus += resolveNumeric(rule, "amount", context, target);
      } else {
        multiplicativeFactor *= resolveNumeric(
          rule,
          "factor",
          context,
          target,
        );
      }
    }
    const includeSigil = typeof policy.includeSigil === "function"
      ? policy.includeSigil(context)
      : policy.includeSigil;
    // Dynamic policies support weapon-set or event-specific sigil inclusion.
    if (typeof includeSigil !== "boolean") {
      throw new TypeError(
        `Modifier bucket policy "${target}" includeSigil must resolve to a boolean.`,
      );
    }
    return applyAdditiveDamageBucket(context, initialValue, {
      damageType,
      bonus: additiveBonus,
      includeSigil,
    }) * multiplicativeFactor;
  });
}

/**
 * Compiles declarative profession scalar modifiers into the existing
 * profession hook contract.
 *
 * Rules declare a unique id, one or more targets, an operation, and either an
 * amount or factor. Optional `when(context)` gates a rule; `order` controls
 * deterministic execution before declaration order breaks ties.
 */
export function createModifierHooks({
  rules = [],
  damageBuckets = {},
} = {}) {
  const normalizedRules = normalizeRules(rules);
  const policies = normalizeBucketPolicies(damageBuckets);
  const rulesByTarget = Object.fromEntries(
    [...TARGETS].map(target => [target, []]),
  );
  for (const rule of normalizedRules) {
    for (const target of rule.targets) rulesByTarget[target].push(rule);
  }
  for (const target of TARGETS) {
    // Stable declaration order is the final tie-breaker for equal rule order.
    rulesByTarget[target].sort((left, right) =>
      left.order - right.order
      || left.declarationIndex - right.declarationIndex);
    Object.freeze(rulesByTarget[target]);
  }
  Object.freeze(rulesByTarget);

  const hooks = {};
  for (const target of TARGETS) {
    hooks[HOOK_BY_TARGET[target]] = DAMAGE_TARGETS.has(target)
      ? createDamageHook(rulesByTarget[target], target, policies[target])
      : createScalarHook(rulesByTarget[target], target);
  }
  return Object.freeze(hooks);
}
