import { normalizeWeaponSigils } from "../../platform/gw2/weapon-sigils.js";
import { createGw2BuildCodec } from "../../platform/gw2/build-codec.js";
import { createDefaultTargetConditions } from "../../platform/gw2/default-target-conditions.js";
import { guardianCatalog } from "./catalog.js";

/**
 * Guardian persisted-build definition.
 *
 * This module supplies Guardian defaults and configures the shared GW2 build
 * codec for migration, normalization, validation, and app-facing conversion.
 * Its profession-specific rule normalizes and validates the initial number of
 * Firebrand tome pages.
 */

export const GUARDIAN_BUILD_SCHEMA_VERSION = 3;
export const GUARDIAN_PROFESSION_ID = "guardian";

export { createDefaultTargetConditions };

export function createGuardianBuildDefaults() {
  return {
    schemaVersion: GUARDIAN_BUILD_SCHEMA_VERSION,
    profession: GUARDIAN_PROFESSION_ID,
    gear: {
      Helm: "Berserker's",
      Shoulders: "Berserker's",
      Chest: "Dragon's",
      Gloves: "Berserker's",
      Leggins: "Dragon's",
      Boots: "Berserker's",
      Amulet: "Dragon's",
      Ring1: "Dragon's",
      Ring2: "Dragon's",
      Accessory1: "Berserker's",
      Accessory2: "Berserker's",
      Back: "Dragon's",
      Weapon1: "Berserker's",
      Weapon2: "Berserker's",
    },
    weapons: ["Spear", ""],
    alternateWeapons: ["Greatsword", ""],
    rune: "Dragonhunter",
    weaponSigils: normalizeWeaponSigils([
      ["Force", "Impact"],
      ["Force", "Impact"],
    ]),
    relic: "Dragonhunter",
    food: "Cilantro Lime Sous-Vide Steak",
    utility: "Superior Sharpening Stone",
    jadeBotCore: true,
    infusions: [
      { stat: "Power", count: 18 },
      { stat: "Precision", count: 0 },
      { stat: "Condition Damage", count: 0 },
    ],
    specializations: [
      { name: "Radiance", traits: "3-3-3" },
      { name: "Zeal", traits: "2-2-3" },
      { name: "Dragonhunter", traits: "1-2-3" },
    ],
    selectedSkills: {
      Heal: "Purification",
      Utility1: "Procession of Blades",
      Utility2: "Sword of Justice",
      Utility3: "Bane Signet",
      Elite: "Dragon's Maw",
    },
    assumptions: {
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
    initialResource: 0,
    initialTomePages: 5,
    startingWeaponSet: 1,
    targetHealth: 3_970_000,
    targetArmor: 2597,
    rotation: [],
  };
}

const guardianBuildCodec = createGw2BuildCodec({
  professionId: GUARDIAN_PROFESSION_ID,
  schemaVersion: GUARDIAN_BUILD_SCHEMA_VERSION,
  catalog: guardianCatalog,
  createDefaults: createGuardianBuildDefaults,
  normalizeExtra(build, { saved }) {
    const configured = Number(saved.initialTomePages ?? 5);
    return {
      ...build,
      initialTomePages: Math.max(
        0,
        Math.min(8, Math.trunc(Number.isFinite(configured) ? configured : 5)),
      ),
    };
  },
  validateExtra(build) {
    return Number(build.initialTomePages) >= 0 &&
      Number(build.initialTomePages) <= 8
      ? []
      : ["initialTomePages must be between 0 and 8."];
  },
});

export const migrateGuardianBuild = guardianBuildCodec.migrateBuild;
export const validateGuardianBuild = guardianBuildCodec.validateBuild;
export const toApplicationBuild = guardianBuildCodec.toApplicationBuild;
