/**
 * Maps legacy target-condition fields to their modern counterparts.
 * Used for backward compatibility with older config formats.
 */
const LEGACY_TARGET_FIELDS = {
  Vulnerability: "vulnerability",
  Slow: "slowed",
};

/**
 * Resolves condition value from config, checking legacy fields first,
 * then modern conditions object with case-insensitive matching.
 * @param {Object} config - Simulation config containing target state
 * @param {string} name - Condition name (e.g., "Vulnerability", "Slow")
 * @returns {number|boolean} Configured value or 0 if not found
 * @private
 */
function configuredConditionValue(config, name) {
  const legacyField = LEGACY_TARGET_FIELDS[name];
  if (legacyField && Object.hasOwn(config.target || {}, legacyField)) {
    return config.target[legacyField];
  }

  const conditions = config.target?.conditions || {};
  if (Object.hasOwn(conditions, name)) return conditions[name];

  const normalized = String(name).toLowerCase();
  const entry = Object.entries(conditions)
    .find(([condition]) => condition.toLowerCase() === normalized);
  if (entry) return entry[1];

  return 0;
}

/**
 * Gets stack count of permanent condition on target.
 * Boolean true converts to 1 stack; numeric values preserved; falsy returns 0.
 * @param {Object} config - Simulation config
 * @param {string} name - Condition name to check
 * @returns {number} Stack count (≥0)
 * @example
 * permanentTargetConditionStacks(config, "Vulnerability") // → 2
 */
export function permanentTargetConditionStacks(config, name) {
  const value = configuredConditionValue(config, name);
  if (value === true) return 1;
  return Math.max(0, Number(value) || 0);
}

/**
 * Checks whether target has active permanent condition.
 * @param {Object} config - Simulation config
 * @param {string} name - Condition name to check
 * @returns {boolean} True if condition stacks > 0
 * @example
 * targetHasPermanentCondition(config, "Vulnerability") // → true
 */
export function targetHasPermanentCondition(config, name) {
  return permanentTargetConditionStacks(config, name) > 0;
}
