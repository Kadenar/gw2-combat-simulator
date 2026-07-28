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

function normalizedControl(control) {
  const type = control?.type === "select"
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
    result.options = (control.options || []).map(option =>
      typeof option === "object"
        ? {
            value: String(option.value),
            label: String(option.label || option.value),
          }
        : { value: String(option), label: String(option) });
    if (!result.options.length) {
      throw new TypeError(`Assumption control ${key} needs select options.`);
    }
  }
  return Object.freeze(result);
}

export function createProfessionAssumptionControls(controls = []) {
  const normalized = controls.map(normalizedControl);
  if (new Set(normalized.map(control => control.key)).size !== normalized.length) {
    throw new TypeError("Assumption control keys must be unique.");
  }
  return Object.freeze(normalized);
}

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
      result[control.key] = control.options.some(option =>
        option.value === candidate)
        ? candidate
        : String(control.defaultValue ?? control.options[0].value);
    }
  }
  return result;
}

export function validateProfessionAssumptions(
  assumptions,
  controls = [],
) {
  const errors = [];
  for (const control of controls) {
    const value = assumptions?.[control.key];
    if (control.type === "boolean" && typeof value !== "boolean") {
      errors.push(`assumptions.${control.key} must be boolean.`);
    } else if (
      control.type === "number"
      && (
        !Number.isFinite(Number(value))
        || Number(value) < control.minimum
        || Number(value) > control.maximum
      )
    ) {
      errors.push(
        `assumptions.${control.key} must be between ${control.minimum} and ${control.maximum}.`,
      );
    } else if (
      control.type === "select"
      && !control.options.some(option => option.value === String(value))
    ) {
      errors.push(`assumptions.${control.key} must be a legal choice.`);
    }
  }
  return errors;
}

