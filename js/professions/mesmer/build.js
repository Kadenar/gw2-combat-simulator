import {
  GEAR_SLOTS,
} from "../../platform/gw2/gear-data.js";
import {
  DEFAULT_WEAPON_SIGILS,
  normalizeWeaponSigils,
} from "../../platform/gw2/weapon-sigils.js";
import {
  createGw2BuildCodec,
} from "../../platform/gw2/build-codec.js";
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
    gear: Object.fromEntries(
      GEAR_SLOTS.map(slot => [slot, "Berserker's"]),
    ),
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
    targetHealth: 3_970_000,
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
  const migrated = {
    ...saved,
    schemaVersion: 1,
    profession: PROFESSION_ID,
  };
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
      initialResource: Math.max(
        0,
        Math.min(5, Number(saved.initialResource ?? 5) || 0),
      ),
    };
  },
  validateExtra(build) {
    return (
      Number(build.initialResource) >= 0
      && Number(build.initialResource) <= 5
    )
      ? []
      : ["initialResource must be between 0 and 5."];
  },
});

export const migrateMesmerBuild = mesmerBuildCodec.migrateBuild;
export const validateMesmerBuild = mesmerBuildCodec.validateBuild;
export const toApplicationBuild = mesmerBuildCodec.toApplicationBuild;
