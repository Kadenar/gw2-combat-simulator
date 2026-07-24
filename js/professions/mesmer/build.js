import {
  GEAR_SLOTS,
  GEAR_STATS,
  INFUSION_STATS,
  RELIC_NAMES,
  WEAPON_DATA,
} from "../../data/gear-data.js";
import {
  DEFAULT_WEAPON_SIGILS,
  normalizeWeaponSigils,
} from "../../core/weapon-sigils.js";
import {
  normalizeRotation,
  toLegacyRotationEntry,
} from "../../platform/engine/rotation-commands.js";
import { mesmerCatalog } from "./catalog.js";

export const BUILD_SCHEMA_VERSION = 3;
export const PROFESSION_ID = "mesmer";

export function createDefaultTargetConditions() {
  return {
    Bleeding: 1,
    Burning: true,
    Torment: 1,
    Confusion: 1,
    Poisoned: true,
    Chilled: true,
    Cripple: true,
    Slow: true,
    Weakness: true,
    Vulnerability: 25,
  };
}

export function createMesmerBuildDefaults() {
  return {
    schemaVersion: BUILD_SCHEMA_VERSION,
    profession: PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map(slot => [slot, "Berserker's"])),
    weapons: ["Dagger", "Sword"],
    alternateWeapons: ["Spear", ""],
    rune: "Scholar",
    weaponSigils: normalizeWeaponSigils(DEFAULT_WEAPON_SIGILS),
    relic: "Thief",
    food: "Bowl of Sweet and Spicy Butternut Squash Soup",
    utility: "Superior Sharpening Stone",
    jadeBotCore: true,
    infusions: [
      { stat: "Power", count: 18 },
      { stat: "Precision", count: 0 },
      { stat: "Condition Damage", count: 0 },
    ],
    specializations: [
      { name: "Dueling", traits: "1-3-1" },
      { name: "Illusions", traits: "1-2-1" },
      { name: "Virtuoso", traits: "3-3-3" },
    ],
    selectedSkills: {
      Heal: "Twin Blade Restoration",
      Utility1: "Signet of Domination",
      Utility2: "Mantra of Pain",
      Utility3: "Rain of Swords",
      Elite: "Thousand Cuts",
    },
    assumptions: {
      might: 25,
      fury: true,
      quickness: true,
      alacrity: true,
      regeneration: true,
      vigor: true,
      targetMoving: false,
      targetBoonless: true,
      targetConditions: createDefaultTargetConditions(),
      targetSkillActivationsPerSecond: 0,
    },
    initialResource: 5,
    startingWeaponSet: 1,
    targetHealth: 4_000_000,
    targetArmor: 2597,
    rotation: [],
  };
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function migrateV0ToV1(saved) {
  const migrated = { ...saved, schemaVersion: 1, profession: PROFESSION_ID };
  if (!Array.isArray(migrated.weaponSigils) && Array.isArray(migrated.sigils)) {
    migrated.weaponSigils = [migrated.sigils, migrated.sigils];
  }
  return migrated;
}

function migrateV1ToV2(saved) {
  const migrated = { ...saved, schemaVersion: 2 };
  const assumptions = plainObject(migrated.assumptions);
  if (
    assumptions.targetConditions == null
    && assumptions.vulnerability != null
  ) {
    assumptions.targetConditions = {
      ...createDefaultTargetConditions(),
      Vulnerability: assumptions.vulnerability,
    };
  }
  delete assumptions.vulnerability;
  delete assumptions.targetHealthAbove50;
  migrated.assumptions = assumptions;
  return migrated;
}

function migrateV2ToV3(saved) {
  return {
    ...saved,
    schemaVersion: 3,
    profession: PROFESSION_ID,
    rotation: normalizeRotation(saved.rotation, mesmerCatalog),
  };
}

function applyDefaults(saved) {
  const defaults = createMesmerBuildDefaults();
  const assumptions = plainObject(saved.assumptions);
  const selectedSkills = plainObject(saved.selectedSkills);
  const savedConditions = Object.hasOwn(assumptions, "targetConditions")
    ? plainObject(assumptions.targetConditions)
    : defaults.assumptions.targetConditions;
  const merged = {
    ...defaults,
    ...saved,
    schemaVersion: BUILD_SCHEMA_VERSION,
    profession: PROFESSION_ID,
    gear: { ...defaults.gear, ...plainObject(saved.gear) },
    assumptions: {
      ...defaults.assumptions,
      ...assumptions,
      targetConditions: { ...savedConditions },
    },
    selectedSkills: { ...defaults.selectedSkills, ...selectedSkills },
    weapons: [0, 1].map(index => {
      const value = Array.isArray(saved.weapons) ? saved.weapons[index] : null;
      return typeof value === "string" && (value === "" || WEAPON_DATA[value])
        ? value
        : defaults.weapons[index];
    }),
    alternateWeapons: [0, 1].map(index => {
      const value = Array.isArray(saved.alternateWeapons)
        ? saved.alternateWeapons[index]
        : null;
      return typeof value === "string" && (value === "" || WEAPON_DATA[value])
        ? value
        : defaults.alternateWeapons[index];
    }),
    weaponSigils: normalizeWeaponSigils(saved.weaponSigils),
    infusions: Array.isArray(saved.infusions)
      ? saved.infusions
        .filter(value =>
          value
          && typeof value === "object"
          && INFUSION_STATS.includes(value.stat))
        .map(value => ({
          stat: value.stat,
          count: Math.max(0, Math.min(18, Math.trunc(Number(value.count) || 0))),
        }))
      : defaults.infusions,
    specializations: Array.isArray(saved.specializations)
      ? saved.specializations
        .filter(value =>
          value
          && typeof value === "object"
          && mesmerCatalog.specializations.some(spec => spec.name === value.name)
          && /^[1-3]-[1-3]-[1-3]$/.test(String(value.traits || "")))
        .slice(0, 3)
      : defaults.specializations,
    rotation: normalizeRotation(saved.rotation, mesmerCatalog),
  };
  const legacyPrefixes = {
    Berserker: "Berserker's",
    Assassin: "Assassin's",
    Viper: "Viper's",
    Dragon: "Dragon's",
    Ritualist: "Ritualist's",
    Trailblazer: "Trailblazer's",
  };
  for (const slot of GEAR_SLOTS) {
    merged.gear[slot] = legacyPrefixes[merged.gear[slot]] || merged.gear[slot];
    if (!GEAR_STATS[merged.gear[slot]]) merged.gear[slot] = defaults.gear[slot];
  }
  for (const [slot, fallback] of Object.entries(defaults.selectedSkills)) {
    const selected = merged.selectedSkills[slot];
    if (
      typeof selected !== "string"
      || (selected && !mesmerCatalog.skillsByName.has(selected))
    ) {
      merged.selectedSkills[slot] = fallback;
    }
  }
  if (!RELIC_NAMES.includes(merged.relic)) merged.relic = defaults.relic;
  delete merged.sigils;
  return merged;
}

export function migrateMesmerBuild(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createMesmerBuildDefaults();
  }
  if (candidate.profession && candidate.profession !== PROFESSION_ID) {
    throw new Error(`Cannot load ${candidate.profession} build as Mesmer.`);
  }
  let saved = structuredClone(candidate);
  let version = Number(saved.schemaVersion || 0);
  if (!Number.isInteger(version) || version < 0 || version > BUILD_SCHEMA_VERSION) {
    throw new Error(`Unsupported build schema version: ${saved.schemaVersion}`);
  }
  if (version === 0) {
    saved = migrateV0ToV1(saved);
    version = 1;
  }
  if (version === 1) {
    saved = migrateV1ToV2(saved);
    version = 2;
  }
  if (version === 2) saved = migrateV2ToV3(saved);
  return applyDefaults(saved);
}

export function validateMesmerBuild(build) {
  const errors = [];
  if (!build || typeof build !== "object" || Array.isArray(build)) {
    errors.push("Build must be an object.");
  } else {
    if (build.schemaVersion !== BUILD_SCHEMA_VERSION) {
      errors.push(`schemaVersion must be ${BUILD_SCHEMA_VERSION}.`);
    }
    if (build.profession !== PROFESSION_ID) {
      errors.push("profession must be mesmer.");
    }
    if (!Array.isArray(build.rotation)) errors.push("rotation must be an array.");
    if (!Array.isArray(build.specializations)) {
      errors.push("specializations must be an array.");
    }
    if (!plainObject(build.gear) || Array.isArray(build.gear)) {
      errors.push("gear must be an object.");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function toApplicationBuild(build) {
  const migrated = migrateMesmerBuild(build);
  return {
    ...migrated,
    rotation: migrated.rotation.map(command =>
      toLegacyRotationEntry(command, mesmerCatalog)),
  };
}
