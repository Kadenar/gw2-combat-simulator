import { GEAR_SLOTS } from "../../platform/gw2/gear-data.js";
import {
  DEFAULT_WEAPON_SIGILS,
  normalizeWeaponSigils,
} from "../../platform/gw2/weapon-sigils.js";
import { createGw2BuildCodec } from "../../platform/gw2/build-codec.js";
import { createDefaultTargetConditions } from "../../platform/gw2/default-target-conditions.js";
import {
  DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS,
  normalizeSimulationRandomnessAssumptions,
  validateSimulationRandomnessAssumptions,
} from "../../app/simulation/randomness.js";
import { mesmerCatalog } from "./catalog.js";
import { resolveMesmerLegacySkillId } from "./data/legacy-skill-resolver.js";
import type { SchedulerRecord } from "../../platform/engine/types.js";
import type { MesmerCanonicalBuild } from "./types.js";

/**
 * Mesmer persisted-build definition.
 *
 * This module supplies Mesmer defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * It includes the explicit legacy migrations for sigils and target-condition
 * assumptions and constrains the initial clone, blade, or note resource.
 */

export const BUILD_SCHEMA_VERSION = 3;
export const PROFESSION_ID = "mesmer";

export { createDefaultTargetConditions };

export function createMesmerBuildDefaults(): MesmerCanonicalBuild {
  return {
    schemaVersion: BUILD_SCHEMA_VERSION,
    profession: PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    alternateWeaponPrefixes: ["Berserker's", "Berserker's"],
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
      ...DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS,
      might: 25,
      fury: true,
      quickness: true,
      alacrity: true,
      protection: true,
      resolution: true,
      regeneration: true,
      swiftness: true,
      vigor: true,
      aegis: false,
      targetMoving: false,
      targetBoonless: true,
      targetConditions: createDefaultTargetConditions(),
      targetSkillActivationsPerSecond: 0,
    },
    initialResource: 5,
    startingWeaponSet: 1,
    targetHealth: 3_970_000,
    targetArmor: 2597,
    rotation: [],
  };
}

function plainObject(value: unknown): SchedulerRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SchedulerRecord)
    : {};
}

function migrateV0ToV1(saved: SchedulerRecord): SchedulerRecord {
  const migrated: SchedulerRecord = {
    ...saved,
    schemaVersion: 1,
    profession: PROFESSION_ID,
  };
  if (!Array.isArray(migrated.weaponSigils) && Array.isArray(migrated.sigils)) {
    migrated.weaponSigils = [migrated.sigils, migrated.sigils];
  }
  return migrated;
}

function migrateV1ToV2(saved: SchedulerRecord): SchedulerRecord {
  const migrated: SchedulerRecord = { ...saved, schemaVersion: 2 };
  const assumptions = plainObject(migrated.assumptions);
  if (
    assumptions.targetConditions == null &&
    assumptions.vulnerability != null
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

function migrateV2ToV3(saved: SchedulerRecord): SchedulerRecord {
  return {
    ...saved,
    schemaVersion: 3,
    profession: PROFESSION_ID,
  };
}

const mesmerBuildCodec = createGw2BuildCodec({
  professionId: PROFESSION_ID,
  schemaVersion: BUILD_SCHEMA_VERSION,
  catalog: mesmerCatalog,
  createDefaults: createMesmerBuildDefaults,
  migrations: {
    0: migrateV0ToV1,
    1: migrateV1ToV2,
    2: migrateV2ToV3,
  },
  normalizeExtra(build, { saved }) {
    return {
      ...build,
      assumptions: normalizeSimulationRandomnessAssumptions(build.assumptions),
      initialResource: Math.max(
        0,
        Math.min(5, Number(saved.initialResource ?? 5) || 0),
      ),
    };
  },
  validateExtra(build) {
    const errors = validateSimulationRandomnessAssumptions(build.assumptions);
    if (!(
      Number(build.initialResource) >= 0 && Number(build.initialResource) <= 5
    )) {
      errors.push("initialResource must be between 0 and 5.");
    }
    return errors;
  },
});

function configuredSpecialization(candidate: unknown = {}): string {
  const saved = plainObject(candidate);
  if (saved.specialization) return String(saved.specialization);
  const eliteNames = new Set(
    mesmerCatalog.specializations
      .filter((specialization) => specialization.elite)
      .map((specialization) => specialization.name),
  );
  return (
    (Array.isArray(saved.specializations) ? saved.specializations : [])
      .flatMap((selection) => {
        const name = plainObject(selection).name;
        return name == null ? [] : [String(name)];
      })
      .find((name) => eliteNames.has(name)) || "Core"
  );
}

function resolveLegacyRotation(candidate: unknown = {}): unknown[] {
  const saved = plainObject(candidate);
  const specialization = configuredSpecialization(saved);
  const rotation = Array.isArray(saved.rotation) ? saved.rotation : [];
  return rotation.map((entry: unknown) => {
    if (typeof entry === "string") {
      const resolved = resolveMesmerLegacySkillId(entry, { specialization });
      return resolved === undefined
        ? entry
        : resolved == null
          ? { type: "cast", skillId: entry }
          : { type: "cast", skillId: resolved };
    }
    const record = plainObject(entry);
    if (
      !entry ||
      typeof entry !== "object" ||
      record.skillId != null ||
      record.id != null
    ) {
      return entry;
    }
    const resolved = resolveMesmerLegacySkillId(String(record.name || ""), {
      specialization,
    });
    if (resolved === undefined) return entry;
    return {
      ...record,
      skillId: resolved ?? record.name,
    };
  });
}

export function migrateMesmerBuild(saved: unknown): MesmerCanonicalBuild {
  const source = plainObject(saved);
  return mesmerBuildCodec.migrateBuild({
    ...source,
    rotation: resolveLegacyRotation(source),
  });
}
export const validateMesmerBuild = mesmerBuildCodec.validateBuild;
export function toApplicationBuild(saved: unknown) {
  return mesmerBuildCodec.toApplicationBuild(migrateMesmerBuild(saved));
}
