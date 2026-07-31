import type {
  ProfessionAssumptionControl,
  ProfessionAssumptionControlInput,
  ProfessionAssumptionOption,
} from "./types.js";

/**
 * Standard positioning and health assumptions available to professions.
 */
export const STANDARD_POSITION_ASSUMPTION_CONTROLS: ReadonlyArray<ProfessionAssumptionControl> =
  Object.freeze([
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

function normalizedSpecializations(
  value: unknown,
): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  return Object.freeze([...new Set(value.map(String))]);
}

function normalizedControl(
  control: ProfessionAssumptionControlInput,
): ProfessionAssumptionControl {
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
  const common = {
    key,
    label: String(control.label || key),
    defaultValue: control.defaultValue,
    ...(control.section ? { section: String(control.section) } : {}),
    ...(normalizedSpecializations(control.specializations)
      ? {
          specializations: normalizedSpecializations(control.specializations),
        }
      : {}),
  };

  if (type === "number") {
    return Object.freeze({
      ...common,
      type,
      minimum: Number.isFinite(Number(control.minimum))
        ? Number(control.minimum)
        : Number.NEGATIVE_INFINITY,
      maximum: Number.isFinite(Number(control.maximum))
        ? Number(control.maximum)
        : Number.POSITIVE_INFINITY,
      step: Number(control.step || 1),
    });
  }

  if (type === "select") {
    const sourceOptions: unknown[] = Array.isArray(control.options)
      ? control.options
      : [];
    const options: ProfessionAssumptionOption[] = sourceOptions.map(
      (option) => {
        if (!option || typeof option !== "object" || Array.isArray(option)) {
          return { value: String(option), label: String(option) };
        }
        const source = option as Record<string, unknown>;
        return {
          value: String(source.value),
          label: String(source.label || source.value),
          ...(Number.isFinite(Number(source.skillId))
            ? { skillId: Number(source.skillId) }
            : {}),
          ...(source.icon ? { icon: String(source.icon) } : {}),
        };
      },
    );
    if (!options.length) {
      throw new TypeError(`Assumption control ${key} needs select options.`);
    }
    return Object.freeze({
      ...common,
      type,
      options,
    });
  }

  return Object.freeze({
    ...common,
    type,
  });
}

/**
 * Creates an immutable, validated set of profession assumption controls.
 */
export function createProfessionAssumptionControls(
  controls: ReadonlyArray<ProfessionAssumptionControlInput> = [],
): ReadonlyArray<ProfessionAssumptionControl> {
  const normalized = controls.map(normalizedControl);
  if (
    new Set(normalized.map((control) => control.key)).size !== normalized.length
  ) {
    throw new TypeError("Assumption control keys must be unique.");
  }
  return Object.freeze(normalized);
}

export function assumptionControlsForSpecialization(
  controls: ReadonlyArray<ProfessionAssumptionControl> = [],
  specialization = "Core",
): ProfessionAssumptionControl[] {
  return controls.filter(
    (control) =>
      !control.specializations?.length ||
      control.specializations.includes(String(specialization)),
  );
}

export function normalizeProfessionAssumptions(
  assumptions: Record<string, unknown> = {},
  controls: ReadonlyArray<ProfessionAssumptionControl> = [],
): Record<string, unknown> {
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

export function validateProfessionAssumptions(
  assumptions: Record<string, unknown> | null | undefined,
  controls: ReadonlyArray<ProfessionAssumptionControl> = [],
): string[] {
  const errors: string[] = [];
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
