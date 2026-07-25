import {
  normalizeRotation,
} from "../../platform/engine/rotation-commands.js";
import { guardianCatalog } from "./catalog.js";

export const GUARDIAN_BUILD_SCHEMA_VERSION = 3;

export function createGuardianBuildDefaults() {
  return {
    schemaVersion: GUARDIAN_BUILD_SCHEMA_VERSION,
    profession: "guardian",
    weapons: ["Sword", ""],
    alternateWeapons: ["Longbow", ""],
    startingWeaponSet: 1,
    rotation: [],
  };
}

export function migrateGuardianBuild(candidate) {
  if (candidate?.profession && candidate.profession !== "guardian") {
    throw new Error(`Cannot load ${candidate.profession} build as Guardian.`);
  }
  const defaults = createGuardianBuildDefaults();
  const saved = candidate && typeof candidate === "object" ? candidate : {};
  return {
    ...defaults,
    ...saved,
    schemaVersion: GUARDIAN_BUILD_SCHEMA_VERSION,
    profession: "guardian",
    weapons: Array.isArray(saved.weapons)
      ? [saved.weapons[0] || "Sword", saved.weapons[1] || ""]
      : defaults.weapons,
    alternateWeapons: Array.isArray(saved.alternateWeapons)
      ? [saved.alternateWeapons[0] || "Longbow", saved.alternateWeapons[1] || ""]
      : defaults.alternateWeapons,
    rotation: normalizeRotation(saved.rotation, guardianCatalog),
  };
}

export function validateGuardianBuild(build) {
  const errors = [];
  if (build?.profession !== "guardian") errors.push("profession must be guardian.");
  if (build?.schemaVersion !== GUARDIAN_BUILD_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${GUARDIAN_BUILD_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(build?.rotation)) errors.push("rotation must be an array.");
  return { valid: errors.length === 0, errors };
}
