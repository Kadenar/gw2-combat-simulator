import { GEAR_SLOTS } from "../../platform/gw2/gear-data.js";
import { normalizeWeaponSigils } from "../../platform/gw2/weapon-sigils.js";
import { createGw2BuildCodec } from "../../platform/gw2/build-codec.js";
import { createDefaultTargetConditions } from "../../platform/gw2/default-target-conditions.js";
import {
  normalizeProfessionAssumptions,
  validateProfessionAssumptions,
} from "../../app/profession/assumptions.js";
import {
  DEFAULT_SIMULATION_RANDOMNESS_ASSUMPTIONS,
  normalizeSimulationRandomnessAssumptions,
} from "../../app/simulation/randomness.js";
import { RANGER_ASSUMPTION_CONTROLS } from "./assumptions.js";
import { rangerCatalog } from "./catalog.js";
import { RANGER_PETS } from "./data/ranger-pet-data.js";
import {
  DEFAULT_RANGER_HAMMER_SKILL_IDS,
  normalizeRangerHammerSkillIds,
  RANGER_HAMMER_VARIANT_PAIRS,
} from "./core/hammer.js";
import type { RangerCanonicalBuild } from "./types.js";

export const RANGER_BUILD_SCHEMA_VERSION = 3;
export const RANGER_PROFESSION_ID = "ranger";

export { createDefaultTargetConditions };

export function createRangerBuildDefaults(): RangerCanonicalBuild {
  return {
    schemaVersion: RANGER_BUILD_SCHEMA_VERSION,
    profession: RANGER_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, "Berserker's"])),
    weapons: ["Axe", "Axe"],
    alternateWeapons: ["Hammer", ""],
    rune: "Scholar",
    weaponSigils: normalizeWeaponSigils([
      ["Force", "Impact"],
      ["Force", "Impact"],
    ]),
    relic: "Fireworks",
    food: "Cilantro Lime Sous-Vide Steak",
    utility: "Superior Sharpening Stone",
    jadeBotCore: true,
    infusions: [
      { stat: "Power", count: 18 },
      { stat: "Precision", count: 0 },
      { stat: "Condition Damage", count: 0 },
    ],
    specializations: [
      { name: "Marksmanship", traits: "2-2-1" },
      { name: "Skirmishing", traits: "1-3-3" },
      { name: "Soulbeast", traits: "3-1-1" },
    ],
    selectedSkills: {
      Heal: '"We Heal As One!"',
      Utility1: '"Sic \'Em!"',
      Utility2: "Frost Trap",
      Utility3: "Signet of the Wild",
      Elite: "One Wolf Pack",
    },
    selectedPet: "Lynx",
    selectedHammerSkillIds: [...DEFAULT_RANGER_HAMMER_SKILL_IDS],
    initialUntamedState: "Pet",
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
      ...normalizeProfessionAssumptions({}, RANGER_ASSUMPTION_CONTROLS),
    },
    initialAstralForce: 100,
    initialArrows: 8,
    startingWeaponSet: 1,
    targetHealth: 3_970_000,
    targetArmor: 2597,
    rotation: [],
  };
}

const rangerBuildCodec = createGw2BuildCodec<RangerCanonicalBuild>({
  professionId: RANGER_PROFESSION_ID,
  schemaVersion: RANGER_BUILD_SCHEMA_VERSION,
  catalog: rangerCatalog,
  createDefaults: createRangerBuildDefaults,
  normalizeExtra(build, { saved }) {
    const savedAssumptions =
      saved.assumptions && typeof saved.assumptions === "object"
        ? (saved.assumptions as Record<string, unknown>)
        : {};
    const {
      selectedPet: _legacySelectedPet,
      soulbeastArchetype: _legacySoulbeastArchetype,
      playerHealthPercent: _legacyPlayerHealthPercent,
      targetDistance: _legacyTargetDistance,
      ...supportedAssumptions
    } = build.assumptions;
    const assumptions = normalizeProfessionAssumptions(
      normalizeSimulationRandomnessAssumptions(supportedAssumptions),
      RANGER_ASSUMPTION_CONTROLS,
    );
    const requestedPet = String(
      saved.selectedPet ?? savedAssumptions.selectedPet ?? "Lynx",
    );
    const selectedPet = RANGER_PETS.some((pet) => pet.name === requestedPet)
      ? requestedPet
      : "Lynx";
    return {
      ...build,
      assumptions,
      selectedPet,
      selectedHammerSkillIds: normalizeRangerHammerSkillIds(
        saved.selectedHammerSkillIds,
      ),
      initialUntamedState:
        saved.initialUntamedState === "Ranger" ? "Ranger" : "Pet",
      initialAstralForce: Math.max(
        0,
        Math.min(100, Number(saved.initialAstralForce ?? 100)),
      ),
      initialArrows: Math.max(0, Math.min(8, Number(saved.initialArrows ?? 8))),
    };
  },
  validateExtra(build) {
    const errors = validateProfessionAssumptions(
      build.assumptions,
      RANGER_ASSUMPTION_CONTROLS,
    );
    if (!(
      Number(build.initialAstralForce) >= 0 &&
      Number(build.initialAstralForce) <= 100
    )) {
      errors.push("initialAstralForce must be between 0 and 100.");
    }
    if (!(
      Number(build.initialArrows) >= 0 && Number(build.initialArrows) <= 8
    )) {
      errors.push("initialArrows must be between 0 and 8.");
    }
    if (!RANGER_PETS.some((pet) => pet.name === build.selectedPet)) {
      errors.push("selectedPet must name an available Ranger pet.");
    }
    if (!["Pet", "Ranger"].includes(build.initialUntamedState)) {
      errors.push('initialUntamedState must be either "Pet" or "Ranger".');
    }
    const selectedHammerSkillIds = Array.isArray(build.selectedHammerSkillIds)
      ? build.selectedHammerSkillIds.map(Number)
      : [];
    if (
      selectedHammerSkillIds.length !== RANGER_HAMMER_VARIANT_PAIRS.length ||
      RANGER_HAMMER_VARIANT_PAIRS.some(
        (pair, index) => !pair.includes(selectedHammerSkillIds[index]),
      )
    ) {
      errors.push(
        "selectedHammerSkillIds must contain one legal Hammer skill for slots 2, 3, 4, and 5.",
      );
    }
    return errors;
  },
});

export const migrateRangerBuild = rangerBuildCodec.migrateBuild;
export const validateRangerBuild = rangerBuildCodec.validateBuild;
export const toApplicationBuild = rangerBuildCodec.toApplicationBuild;
