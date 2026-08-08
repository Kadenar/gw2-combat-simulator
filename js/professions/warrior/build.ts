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
import { warriorCatalog } from "./catalog.js";
import type { WarriorCanonicalBuild } from "./types.js";

export const WARRIOR_BUILD_SCHEMA_VERSION = 3;
export const WARRIOR_PROFESSION_ID = "warrior";
export { createDefaultTargetConditions };

export function createWarriorBuildDefaults(): WarriorCanonicalBuild {
  return {
    schemaVersion: WARRIOR_BUILD_SCHEMA_VERSION,
    profession: WARRIOR_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    weapons: ["Axe", "Axe"],
    alternateWeapons: ["Greatsword", ""],
    rune: "Scholar",
    weaponSigils: normalizeWeaponSigils(DEFAULT_WEAPON_SIGILS),
    relic: "Thief",
    food: "Bowl of Sweet and Spicy Butternut Squash Soup",
    utility: "Superior Sharpening Stone",
    jadeBotCore: true,
    infusions: [{ stat: "Power", count: 18 }],
    specializations: [
      { name: "Strength", traits: "1-1-1" },
      { name: "Discipline", traits: "2-3-3" },
      { name: "Berserker", traits: "1-1-1" },
    ],
    selectedSkills: {
      Heal: "Blood Reckoning",
      Utility1: "Signet of Might",
      Utility2: "Outrage",
      Utility3: "Wild Blow",
      Elite: "Head Butt",
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
    },
    initialResource: 0,
    startingWeaponSet: 1,
    targetHealth: 3_970_000,
    targetArmor: 2597,
    rotation: [],
  };
}

const warriorBuildCodec = createGw2BuildCodec<WarriorCanonicalBuild>({
  professionId: WARRIOR_PROFESSION_ID,
  schemaVersion: WARRIOR_BUILD_SCHEMA_VERSION,
  catalog: warriorCatalog,
  createDefaults: createWarriorBuildDefaults,
  normalizeExtra(build, { saved }) {
    return {
      ...build,
      assumptions: normalizeSimulationRandomnessAssumptions(build.assumptions),
      initialResource: Math.max(
        0,
        Math.min(100, Number(saved.initialResource ?? 0) || 0),
      ),
    };
  },
  validateExtra(build) {
    const errors = validateSimulationRandomnessAssumptions(build.assumptions);
    if (!(
      Number(build.initialResource) >= 0 && Number(build.initialResource) <= 100
    )) {
      errors.push("initialResource must be between 0 and 100.");
    }
    return errors;
  },
});

export const migrateWarriorBuild = warriorBuildCodec.migrateBuild;
export const validateWarriorBuild = warriorBuildCodec.validateBuild;
export const toApplicationBuild = warriorBuildCodec.toApplicationBuild;
