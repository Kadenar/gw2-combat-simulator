import { GEAR_SLOTS } from "../../platform/gw2/gear-data.js";
import {
  DEFAULT_WEAPON_SIGILS,
  normalizeWeaponSigils,
} from "../../platform/gw2/weapon-sigils.js";
import { createGw2BuildCodec } from "../../platform/gw2/build-codec.js";
import {
  normalizeProfessionAssumptions,
  validateProfessionAssumptions,
} from "../../app/profession-assumptions.js";
import { THIEF_ASSUMPTION_CONTROLS } from "./assumptions.js";
import {
  thiefCatalog,
  thiefWeaponSkillMatchesSet,
} from "./catalog.js";

export const THIEF_BUILD_SCHEMA_VERSION = 3;
export const THIEF_PROFESSION_ID = "thief";

export function createDefaultTargetConditions() {
  return {
    Bleeding: 1,
    Poisoned: true,
    Vulnerability: 25,
    Weakness: true,
  };
}
export function createThiefBuildDefaults() {
  return {
    schemaVersion: THIEF_BUILD_SCHEMA_VERSION,
    profession: THIEF_PROFESSION_ID,
    gear: Object.fromEntries(GEAR_SLOTS.map(slot => [slot, "Berserker's"])),
    weapons: ["Rifle", ""],
    alternateWeapons: ["Dagger", "Pistol"],
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
      { name: "Deadly Arts", traits: "1-3-3" },
      { name: "Critical Strikes", traits: "3-2-1" },
      { name: "Deadeye", traits: "1-3-1" },
    ],
    selectedSkills: {
      Heal: "Hide in Shadows",
      Utility1: "Assassin's Signet",
      Utility2: "Shadow Flare",
      Utility3: "Shadow Gust",
      Elite: "Thieves Guild",
    },
    selectedDodge: "Dodge",
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
      ...normalizeProfessionAssumptions({}, THIEF_ASSUMPTION_CONTROLS),
    },
    initialInitiative: 12,
    initialShadowForce: 0,
    startingWeaponSet: 1,
    targetHealth: 3_970_000,
    targetArmor: 2597,
    rotation: [],
  };
}

const thiefBuildCodec = createGw2BuildCodec({
  professionId: THIEF_PROFESSION_ID,
  schemaVersion: THIEF_BUILD_SCHEMA_VERSION,
  catalog: thiefCatalog,
  createDefaults: createThiefBuildDefaults,
  normalizeExtra(build, { saved }) {
    return {
      ...build,
      assumptions: normalizeProfessionAssumptions(
        build.assumptions,
        THIEF_ASSUMPTION_CONTROLS,
      ),
      initialInitiative: Math.max(
        0,
        Math.min(15, Number(saved.initialInitiative ?? 12) || 0),
      ),
      initialShadowForce: Math.max(
        0,
        Math.min(100, Number(saved.initialShadowForce ?? 0) || 0),
      ),
      selectedDodge: [
        "Dodge",
        "Lotus Training",
        "Bounding Dodger",
        "Unhindered Combatant",
      ].includes(saved.selectedDodge)
        ? saved.selectedDodge
        : "Dodge",
    };
  },
  validateExtra(build) {
    const errors = validateProfessionAssumptions(
      build.assumptions,
      THIEF_ASSUMPTION_CONTROLS,
    );
    if (
      !(Number(build.initialInitiative) >= 0
        && Number(build.initialInitiative) <= 15)
    ) errors.push("initialInitiative must be between 0 and 15.");
    if (
      !(Number(build.initialShadowForce) >= 0
        && Number(build.initialShadowForce) <= 100)
    ) errors.push("initialShadowForce must be between 0 and 100.");
    for (const pair of [build.weapons, build.alternateWeapons]) {
      if (!Array.isArray(pair)) continue;
      const [mainHand] = pair;
      if (thiefCatalog.weaponHands.get(mainHand) === "2h") continue;
      const hasThirdSkill = thiefCatalog.skills.some(skill =>
        skill.type === "Weapon"
        && skill.slot === "Weapon_3"
        && !skill.flipParentId
        && thiefWeaponSkillMatchesSet(skill, pair, {
          catalog: thiefCatalog,
        }));
      if (!hasThirdSkill) {
        errors.push(
          `weapon set ${pair[0] || "empty"}/${pair[1] || "empty"} has no legal Thief slot-3 skill.`,
        );
      }
    }
    return errors;
  },
});
export const migrateThiefBuild = thiefBuildCodec.migrateBuild;
export const validateThiefBuild = thiefBuildCodec.validateBuild;
export const toApplicationBuild = thiefBuildCodec.toApplicationBuild;
