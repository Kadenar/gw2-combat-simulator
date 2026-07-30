/**
 * Elementalist persisted-build definition.
 *
 * This module owns the default Elementalist build, upgrades saved build data
 * into the current shape, and validates its profession, weapons, and
 * specialization lines. It describes configuration data consumed by the app;
 * it does not calculate attributes or execute the simulation.
 */
import type {
  ElementalistBuild,
  ElementalistBuildValidation,
} from "./types.js";

export const ELEMENTALIST_BUILD_SCHEMA_VERSION = 1;

const DEFAULT_BUILD: Readonly<ElementalistBuild> = Object.freeze({
  schemaVersion: ELEMENTALIST_BUILD_SCHEMA_VERSION,
  profession: "elementalist",
  gear: {
    Helm: "Berserker's",
    Shoulders: "Berserker's",
    Chest: "Berserker's",
    Gloves: "Berserker's",
    Leggins: "Berserker's",
    Boots: "Berserker's",
    Amulet: "Berserker's",
    Ring1: "Berserker's",
    Ring2: "Berserker's",
    Accessory1: "Berserker's",
    Accessory2: "Berserker's",
    Back: "Berserker's",
    Weapon1: "Berserker's",
    Weapon2: "Berserker's",
  },
  weapons: ["Sword", "Dagger"],
  rune: "Scholar",
  sigils: ["Force", "Impact"],
  relic: "Fireworks",
  food: "Bowl of Sweet and Spicy Butternut Squash Soup",
  utility: "Superior Sharpening Stone",
  jadeBotCore: true,
  specializations: [
    { name: "Fire", traits: "1-3-1" },
    { name: "Air", traits: "3-3-1" },
    { name: "Weaver", traits: "1-2-1" },
  ],
  infusions: [
    { stat: "Power", count: 18 },
    { stat: "Precision", count: 0 },
    { stat: "Condition Damage", count: 0 },
  ],
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createElementalistBuildDefaults(): ElementalistBuild {
  return clone(DEFAULT_BUILD) as ElementalistBuild;
}

export function migrateElementalistBuild(
  saved?: Partial<ElementalistBuild> | {
    readonly profession?: string;
    readonly build?: Partial<ElementalistBuild>;
  } | null,
): ElementalistBuild {
  const source = (
    saved?.build && !saved.profession ? saved.build : saved
  ) as Partial<ElementalistBuild> | null | undefined;
  const defaults = createElementalistBuildDefaults();
  if (!source || typeof source !== "object") return defaults;

  return {
    ...defaults,
    ...clone(source),
    schemaVersion: ELEMENTALIST_BUILD_SCHEMA_VERSION,
    profession: "elementalist",
    gear: { ...defaults.gear, ...(source.gear || {}) },
    weapons: Array.isArray(source.weapons)
      ? source.weapons.slice(0, 2)
      : defaults.weapons,
    specializations: Array.isArray(source.specializations)
      ? clone(source.specializations).slice(0, 3)
      : defaults.specializations,
    infusions: Array.isArray(source.infusions)
      ? clone(source.infusions)
      : defaults.infusions,
  };
}

export function validateElementalistBuild(
  build?: Partial<ElementalistBuild> | null,
): ElementalistBuildValidation {
  const errors: string[] = [];
  if (build?.profession !== "elementalist") {
    errors.push("Build profession must be elementalist.");
  }
  if (!Array.isArray(build?.weapons) || !build.weapons.length) {
    errors.push("At least one weapon is required.");
  }
  if (!Array.isArray(build?.specializations) || build.specializations.length !== 3) {
    errors.push("Exactly three specialization lines are required.");
  }
  return { valid: errors.length === 0, errors };
}
