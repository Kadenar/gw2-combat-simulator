import { GEAR_SLOTS } from "../../platform/gw2/gear-data.js";
import {
  DEFAULT_WEAPON_SIGILS,
  normalizeWeaponSigils,
} from "../../platform/gw2/weapon-sigils.js";
import { createGw2BuildCodec } from "../../platform/gw2/build-codec.js";
import { engineerCatalog } from "./catalog.js";

export const ENGINEER_BUILD_SCHEMA_VERSION = 3;
export const ENGINEER_PROFESSION_ID = "engineer";

const DEFAULT_MORPHS = Object.freeze([77103, 77203, 76954]);
const AMALGAM_MORPHS = new Set(
  engineerCatalog.skills
    .filter(skill =>
      skill.specialization === "Amalgam"
      && [2, 3, 4].includes(Number(skill.mechanicSlot))
      && skill.categories?.includes("Morph"))
    .map(skill => skill.id),
);

export function createDefaultTargetConditions() {
  return {
    Bleeding: 1,
    Burning: true,
    Confusion: 1,
    Poisoned: true,
    Crippled: true,
    Vulnerability: 25,
  };
}

export function createEngineerBuildDefaults() {
  return {
    schemaVersion: ENGINEER_BUILD_SCHEMA_VERSION,
    profession: ENGINEER_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map(slot => [slot, "Viper's"])),
    weapons: ["Rifle", ""],
    alternateWeapons: ["Pistol", "Shield"],
    rune: "Trapper",
    weaponSigils: normalizeWeaponSigils(DEFAULT_WEAPON_SIGILS),
    relic: "Fractal",
    food: "Plate of Beef Rendang",
    utility: "Toxic Tuning Crystal",
    jadeBotCore: true,
    infusions: [
      { stat: "Power", count: 0 },
      { stat: "Precision", count: 0 },
      { stat: "Condition Damage", count: 18 },
    ],
    specializations: [
      { name: "Explosives", traits: "3-2-3" },
      { name: "Firearms", traits: "1-2-3" },
      { name: "Holosmith", traits: "3-2-2" },
    ],
    selectedSkills: {
      Heal: "Healing Turret",
      Utility1: "Grenade Kit",
      Utility2: "Throw Mine",
      Utility3: "Rifle Turret",
      Elite: "Supply Crate",
    },
    selectedMorphSkillIds: [...DEFAULT_MORPHS],
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
    },
    initialHeat: 0,
    startingWeaponSet: 1,
    targetHealth: 3_970_000,
    targetArmor: 2597,
    rotation: [],
  };
}

function normalizeMorphs(value) {
  const source = Array.isArray(value) ? value : DEFAULT_MORPHS;
  const selected = new Map();
  for (const rawId of source) {
    const id = Number(rawId);
    const skill = engineerCatalog.skillsById.get(id);
    const slot = Number(skill?.mechanicSlot);
    if (!AMALGAM_MORPHS.has(id) || ![2, 3, 4].includes(slot)) continue;
    if (!selected.has(slot)) selected.set(slot, id);
  }
  for (const id of DEFAULT_MORPHS) {
    const slot = Number(engineerCatalog.skillsById.get(id)?.mechanicSlot);
    if (!selected.has(slot)) selected.set(slot, id);
  }
  return [2, 3, 4].map(slot => selected.get(slot));
}

const engineerBuildCodec = createGw2BuildCodec({
  professionId: ENGINEER_PROFESSION_ID,
  schemaVersion: ENGINEER_BUILD_SCHEMA_VERSION,
  catalog: engineerCatalog,
  createDefaults: createEngineerBuildDefaults,
  normalizeExtra(build, { saved }) {
    return {
      ...build,
      initialHeat: Math.max(
        0,
        Math.min(150, Number(saved.initialHeat ?? 0) || 0),
      ),
      selectedMorphSkillIds: normalizeMorphs(saved.selectedMorphSkillIds),
    };
  },
  validateExtra(build) {
    const errors = [];
    if (!(Number(build.initialHeat) >= 0 && Number(build.initialHeat) <= 150)) {
      errors.push("initialHeat must be between 0 and 150.");
    }
    const morphs = Array.isArray(build.selectedMorphSkillIds)
      ? build.selectedMorphSkillIds
      : [];
    const slots = morphs.map(id =>
      Number(engineerCatalog.skillsById.get(Number(id))?.mechanicSlot));
    if (
      morphs.length !== 3
      || morphs.some(id => !AMALGAM_MORPHS.has(Number(id)))
      || new Set(slots).size !== 3
      || slots.some(slot => ![2, 3, 4].includes(slot))
    ) {
      errors.push(
        "selectedMorphSkillIds must contain one legal Amalgam morph for F2, F3, and F4.",
      );
    }
    return errors;
  },
});

export const migrateEngineerBuild = engineerBuildCodec.migrateBuild;
export const validateEngineerBuild = engineerBuildCodec.validateBuild;
export const toApplicationBuild = engineerBuildCodec.toApplicationBuild;
