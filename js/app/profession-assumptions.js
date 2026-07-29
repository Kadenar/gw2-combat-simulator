/**
 * A selectable value for a profession assumption.
 *
 * @typedef {Object} ProfessionAssumptionOption
 * @property {string} value Persisted option value.
 * @property {string} label User-facing option label.
 * @property {number} [skillId] Associated GW2 skill ID.
 * @property {string} [icon] Option icon URL.
 */

/**
 * Describes one profession-specific assumption input.
 *
 * @typedef {Object} ProfessionAssumptionControl
 * @property {string} key Stable camelCase key used in persisted assumptions.
 * @property {string} label User-facing control label.
 * @property {"boolean" | "number" | "select"} type Input type.
 * @property {*} defaultValue Value used when the assumption is absent or invalid.
 * @property {number} [minimum] Inclusive minimum for numeric inputs.
 * @property {number} [maximum] Inclusive maximum for numeric inputs.
 * @property {number} [step] Step used by numeric UI inputs.
 * @property {ReadonlyArray<ProfessionAssumptionOption>} [options] Legal values
 * for select inputs.
 * @property {ReadonlyArray<string>} [specializations] Specializations for which
 * the control is visible.
 */

/**
 * Standard positioning and health assumptions available to professions.
 *
 * @type {ReadonlyArray<ProfessionAssumptionControl>}
 */
export const STANDARD_POSITION_ASSUMPTION_CONTROLS = Object.freeze([
  Object.freeze({
    key: "flanking",
    label: "Flanking",
    type: "boolean",
    defaultValue: false,
  }),
  Object.freeze({
    key: "behind",
    label: "Behind target",
    type: "boolean",
    defaultValue: false,
  }),
  Object.freeze({
    key: "targetDistance",
    label: "Target distance",
    type: "number",
    defaultValue: 130,
    minimum: 0,
    maximum: 2000,
    step: 10,
  }),
  Object.freeze({
    key: "playerHealthPercent",
    label: "Player health %",
    type: "number",
    defaultValue: 100,
    minimum: 0,
    maximum: 100,
    step: 1,
  }),
  Object.freeze({
    key: "targetDefiant",
    label: "Defiant target",
    type: "boolean",
    defaultValue: true,
  }),
]);

/**
 * Validates and normalizes an assumption control definition.
 *
 * Unknown control types default to `boolean`. Numeric bounds receive infinite
 * defaults, primitive select options become matching value/label pairs, and
 * duplicate specialization names are removed.
 *
 * @param {Object} control Raw control definition.
 * @returns {ProfessionAssumptionControl} Frozen normalized control.
 * @throws {TypeError} When the key is not camelCase or a select has no options.
 */
function normalizedControl(control) {
  const type =
    control?.type === "select"
      ? "select"
      : control?.type === "number"
        ? "number"
        : "boolean";
  const key = String(control?.key || "").trim();
  if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) {
    throw new TypeError("Assumption controls require stable camelCase keys.");
  }
  const result = {
    key,
    label: String(control.label || key),
    type,
    defaultValue: control.defaultValue,
  };
  if (type === "number") {
    result.minimum = Number.isFinite(Number(control.minimum))
      ? Number(control.minimum)
      : Number.NEGATIVE_INFINITY;
    result.maximum = Number.isFinite(Number(control.maximum))
      ? Number(control.maximum)
      : Number.POSITIVE_INFINITY;
    result.step = Number(control.step || 1);
  }
  if (type === "select") {
    result.options = (control.options || []).map((option) => {
      if (typeof option !== "object") {
        return { value: String(option), label: String(option) };
      }
      const normalized = {
        value: String(option.value),
        label: String(option.label || option.value),
      };
      if (Number.isFinite(Number(option.skillId))) {
        normalized.skillId = Number(option.skillId);
      }
      if (option.icon) normalized.icon = String(option.icon);
      return normalized;
    });
    if (!result.options.length) {
      throw new TypeError(`Assumption control ${key} needs select options.`);
    }
  }
  if (
    Array.isArray(control.specializations) &&
    control.specializations.length
  ) {
    result.specializations = Object.freeze([
      ...new Set(control.specializations.map(String)),
    ]);
  }
  return Object.freeze(result);
}

/**
 * Creates an immutable, validated set of profession assumption controls.
 *
 * @param {Object[]} [controls=[]] Raw control definitions.
 * @returns {ReadonlyArray<ProfessionAssumptionControl>} Frozen normalized controls.
 * @throws {TypeError} When a control is invalid or keys are duplicated.
 */
export function createProfessionAssumptionControls(controls = []) {
  const normalized = controls.map(normalizedControl);
  if (
    new Set(normalized.map((control) => control.key)).size !== normalized.length
  ) {
    throw new TypeError("Assumption control keys must be unique.");
  }
  return Object.freeze(normalized);
}

/**
 * Selects the controls that apply to a specialization.
 *
 * Controls without a specialization restriction apply to every specialization.
 *
 * @param {ReadonlyArray<ProfessionAssumptionControl>} [controls=[]] Controls to filter.
 * @param {string} [specialization="Core"] Active specialization.
 * @returns {ProfessionAssumptionControl[]} Applicable controls in their original order.
 */
export function assumptionControlsForSpecialization(
  controls = [],
  specialization = "Core",
) {
  return controls.filter(
    (control) =>
      !control.specializations?.length ||
      control.specializations.includes(String(specialization)),
  );
}

/**
 * Applies control defaults and coerces assumptions into supported values.
 *
 * Boolean values are coerced, numbers are made finite and clamped to their
 * control bounds, and illegal select values fall back to the configured
 * default or first option. Assumption keys without controls are preserved.
 *
 * @param {Object<string, *>} [assumptions={}] Assumption values to normalize.
 * @param {ReadonlyArray<ProfessionAssumptionControl>} [controls=[]] Control schema.
 * @returns {Object<string, *>} New object containing normalized assumptions.
 */
export function normalizeProfessionAssumptions(
  assumptions = {},
  controls = [],
) {
  const result = { ...assumptions };
  for (const control of controls) {
    const value = assumptions[control.key] ?? control.defaultValue;
    if (control.type === "boolean") {
      result[control.key] = Boolean(value);
    } else if (control.type === "number") {
      const number = Number(value);
      const finite = Number.isFinite(number)
        ? number
        : Number(control.defaultValue || 0);
      result[control.key] = Math.max(
        control.minimum,
        Math.min(control.maximum, finite),
      );
    } else {
      const candidate = String(value);
      result[control.key] = control.options.some(
        (option) => option.value === candidate,
      )
        ? candidate
        : String(control.defaultValue ?? control.options[0].value);
    }
  }
  return result;
}

/**
 * Validates assumption values against a control schema without modifying them.
 *
 * @param {Object<string, *> | null | undefined} assumptions Values to validate.
 * @param {ReadonlyArray<ProfessionAssumptionControl>} [controls=[]] Control schema.
 * @returns {string[]} Validation messages, or an empty array when all controlled
 * values are valid.
 */
export function validateProfessionAssumptions(assumptions, controls = []) {
  const errors = [];
  for (const control of controls) {
    const value = assumptions?.[control.key];
    if (control.type === "boolean" && typeof value !== "boolean") {
      errors.push(`assumptions.${control.key} must be boolean.`);
    } else if (
      control.type === "number" &&
      (!Number.isFinite(Number(value)) ||
        Number(value) < control.minimum ||
        Number(value) > control.maximum)
    ) {
      errors.push(
        `assumptions.${control.key} must be between ${control.minimum} and ${control.maximum}.`,
      );
    } else if (
      control.type === "select" &&
      !control.options.some((option) => option.value === String(value))
    ) {
      errors.push(`assumptions.${control.key} must be a legal choice.`);
    }
  }
  return errors;
}
