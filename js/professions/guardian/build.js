import {
  GEAR_SLOTS,
  GEAR_STATS,
  INFUSION_STATS,
  RELIC_NAMES,
} from "../../platform/gw2/gear-data.js";
import {
  DEFAULT_WEAPON_SIGILS,
  normalizeWeaponSigils,
} from "../../platform/gw2/weapon-sigils.js";
import {
  normalizeRotation,
  toLegacyRotationEntry,
} from "../../platform/engine/rotation-commands.js";
import { guardianCatalog } from "./catalog.js";

export const GUARDIAN_BUILD_SCHEMA_VERSION = 3;
export const GUARDIAN_PROFESSION_ID = "guardian";

const SLOT_TYPES = Object.freeze({
  Heal: "Heal",
  Utility1: "Utility",
  Utility2: "Utility",
  Utility3: "Utility",
  Elite: "Elite",
});

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

export function createGuardianBuildDefaults() {
  return {
    schemaVersion: GUARDIAN_BUILD_SCHEMA_VERSION,
    profession: GUARDIAN_PROFESSION_ID,
    gear: Object.fromEntries(
      GEAR_SLOTS.map(slot => [slot, "Berserker's"]),
    ),
    weapons: ["Greatsword", ""],
    alternateWeapons: ["Sword", "Focus"],
    rune: "Dragonhunter",
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
      { name: "Zeal", traits: "2-2-3" },
      { name: "Radiance", traits: "2-3-3" },
      { name: "Dragonhunter", traits: "1-2-2" },
    ],
    selectedSkills: {
      Heal: "Litany of Wrath",
      Utility1: "Sword of Justice",
      Utility2: "Procession of Blades",
      Utility3: "Bane Signet",
      Elite: "\"Feel My Wrath!\"",
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
    initialResource: 0,
    initialTomePages: 5,
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

function knownWeapon(value) {
  return guardianCatalog.weapons.has(value) ? value : "";
}

function normalizeWeaponPair(value, fallback) {
  if (!Array.isArray(value)) return [...fallback];
  const mainHand = knownWeapon(value[0]) || fallback[0];
  const wielding = guardianCatalog.weaponHands.get(mainHand);
  if (wielding === "2h") return [mainHand, ""];
  const offHand = knownWeapon(value[1]);
  return [
    mainHand,
    offHand && ["oh", "mh+oh"].includes(
      guardianCatalog.weaponHands.get(offHand),
    )
      ? offHand
      : fallback[1],
  ];
}

function normalizeSpecializations(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback.map(specialization => ({ ...specialization }));
  }
  const known = new Set(
    guardianCatalog.specializations.map(specialization => specialization.name),
  );
  const selected = value
    .slice(0, 3)
    .map(entry => typeof entry === "string"
      ? { name: entry, traits: "1-1-1" }
      : {
          name: String(entry?.name || ""),
          traits: /^[1-3]-[1-3]-[1-3]$/.test(String(entry?.traits || ""))
            ? String(entry.traits)
            : "1-1-1",
        })
    .filter(entry => known.has(entry.name));
  return selected.length
    ? selected
    : fallback.map(specialization => ({ ...specialization }));
}

function selectedSkillsFromLegacy(saved) {
  const result = {};
  const ids = Array.isArray(saved.selectedSkillIds)
    ? saved.selectedSkillIds
    : [];
  const skills = ids
    .map(id => guardianCatalog.skillsById.get(id))
    .filter(Boolean);
  result.Heal = skills.find(skill => skill.type === "Heal")?.name;
  result.Elite = skills.find(skill => skill.type === "Elite")?.name;
  const utilities = skills.filter(skill => skill.type === "Utility");
  for (let index = 0; index < 3; index += 1) {
    result[`Utility${index + 1}`] = utilities[index]?.name;
  }
  return result;
}

function normalizeSelectedSkills(saved, defaults) {
  const source = {
    ...selectedSkillsFromLegacy(saved),
    ...plainObject(saved.selectedSkills),
  };
  return Object.fromEntries(Object.entries(SLOT_TYPES).map(([slot, type]) => {
    const candidate = guardianCatalog.skillsByName.get(source[slot]);
    const fallback = guardianCatalog.skillsByName.get(
      defaults.selectedSkills[slot],
    );
    const skill = (
      candidate?.implemented
      && !candidate.simulatorExcluded
      && candidate.type === type
      && candidate.flipParentId == null
    ) ? candidate : fallback;
    return [slot, skill?.name || ""];
  }));
}

function normalizeInfusions(value, fallback) {
  if (!Array.isArray(value)) return structuredClone(fallback);
  const infusions = value
    .filter(entry =>
      entry
      && typeof entry === "object"
      && INFUSION_STATS.includes(entry.stat))
    .map(entry => ({
      stat: entry.stat,
      count: Math.max(
        0,
        Math.min(18, Math.trunc(Number(entry.count) || 0)),
      ),
    }));
  return infusions.length ? infusions : structuredClone(fallback);
}

export function migrateGuardianBuild(candidate) {
  if (
    candidate
    && typeof candidate === "object"
    && candidate.profession
    && candidate.profession !== GUARDIAN_PROFESSION_ID
  ) {
    throw new Error(
      `Cannot load ${candidate.profession} build as Guardian.`,
    );
  }
  const defaults = createGuardianBuildDefaults();
  const saved = candidate && typeof candidate === "object"
    ? structuredClone(candidate)
    : {};
  const assumptions = plainObject(saved.assumptions);
  const conditions = Object.hasOwn(assumptions, "targetConditions")
    ? plainObject(assumptions.targetConditions)
    : defaults.assumptions.targetConditions;
  const gear = {
    ...defaults.gear,
    ...plainObject(saved.gear),
  };
  for (const slot of GEAR_SLOTS) {
    if (!GEAR_STATS[gear[slot]]) gear[slot] = defaults.gear[slot];
  }
  const migrated = {
    ...defaults,
    ...saved,
    schemaVersion: GUARDIAN_BUILD_SCHEMA_VERSION,
    profession: GUARDIAN_PROFESSION_ID,
    gear,
    weapons: normalizeWeaponPair(saved.weapons, defaults.weapons),
    alternateWeapons: normalizeWeaponPair(
      saved.alternateWeapons,
      defaults.alternateWeapons,
    ),
    weaponSigils: normalizeWeaponSigils(saved.weaponSigils),
    specializations: normalizeSpecializations(
      saved.specializations,
      defaults.specializations,
    ),
    selectedSkills: normalizeSelectedSkills(saved, defaults),
    assumptions: {
      ...defaults.assumptions,
      ...assumptions,
      targetConditions: { ...conditions },
    },
    infusions: normalizeInfusions(saved.infusions, defaults.infusions),
    initialTomePages: Math.max(
      0,
      Math.min(8, Math.trunc(Number(saved.initialTomePages ?? 5))),
    ),
    startingWeaponSet: Number(saved.startingWeaponSet) === 2 ? 2 : 1,
    targetHealth: Math.max(
      0,
      Number(saved.targetHealth ?? defaults.targetHealth) || 0,
    ),
    targetArmor: Math.max(
      1,
      Number(saved.targetArmor ?? defaults.targetArmor) || 2597,
    ),
    rotation: normalizeRotation(saved.rotation, guardianCatalog),
  };
  if (!RELIC_NAMES.includes(migrated.relic)) {
    migrated.relic = defaults.relic;
  }
  delete migrated.selectedSkillIds;
  delete migrated.sigils;
  return migrated;
}

function validateWeaponPair(pair, label, errors) {
  if (!Array.isArray(pair) || pair.length !== 2) {
    errors.push(`${label} must contain a main-hand and off-hand slot.`);
    return;
  }
  const [mainHand, offHand] = pair;
  const mainWielding = guardianCatalog.weaponHands.get(mainHand);
  const offWielding = offHand
    ? guardianCatalog.weaponHands.get(offHand)
    : null;
  if (!["mh", "mh+oh", "2h"].includes(mainWielding)) {
    errors.push(`${label} has an invalid main-hand weapon.`);
  }
  if (mainWielding === "2h" && offHand) {
    errors.push(`${mainHand} is two-handed and cannot use ${offHand}.`);
  }
  if (offHand && !["oh", "mh+oh"].includes(offWielding)) {
    errors.push(`${offHand} cannot be equipped in the off hand.`);
  }
}

export function validateGuardianBuild(build) {
  const errors = [];
  if (!build || typeof build !== "object" || Array.isArray(build)) {
    return { valid: false, errors: ["Build must be an object."] };
  }
  if (build.profession !== GUARDIAN_PROFESSION_ID) {
    errors.push("profession must be guardian.");
  }
  if (build.schemaVersion !== GUARDIAN_BUILD_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be ${GUARDIAN_BUILD_SCHEMA_VERSION}.`,
    );
  }
  validateWeaponPair(build.weapons, "weapons", errors);
  validateWeaponPair(build.alternateWeapons, "alternateWeapons", errors);
  if (![1, 2].includes(build.startingWeaponSet)) {
    errors.push("startingWeaponSet must be 1 or 2.");
  }
  if (!Array.isArray(build.rotation)) {
    errors.push("rotation must be an array.");
  } else {
    for (const command of build.rotation) {
      if (
        command?.type === "cast"
        && !guardianCatalog.skillsById.has(command.skillId)
      ) {
        errors.push(`rotation contains unknown skill ${command.skillId}.`);
      }
    }
  }
  if (!Array.isArray(build.specializations)) {
    errors.push("specializations must be an array.");
  } else {
    const known = new Map(
      guardianCatalog.specializations.map(specialization => [
        specialization.name,
        specialization,
      ]),
    );
    const selected = build.specializations
      .map(specialization => known.get(specialization?.name))
      .filter(Boolean);
    if (selected.length !== build.specializations.length) {
      errors.push("specializations contain an unknown Guardian line.");
    }
    if (selected.filter(specialization => specialization.elite).length > 1) {
      errors.push("only one elite specialization can be selected.");
    }
    if (
      new Set(selected.map(specialization => specialization.name)).size
      !== selected.length
    ) {
      errors.push("specializations cannot contain duplicates.");
    }
    if (
      build.specializations.some(specialization =>
        !/^[1-3]-[1-3]-[1-3]$/.test(
          String(specialization?.traits || ""),
        ))
    ) {
      errors.push(
        "specialization traits must use the 1-1-1 selection format.",
      );
    }
    if (build.specializations.length !== 3) {
      errors.push("exactly three specializations must be selected.");
    }
  }
  if (!plainObject(build.selectedSkills)) {
    errors.push("selectedSkills must be an object.");
  } else {
    for (const [slot, type] of Object.entries(SLOT_TYPES)) {
      const skill = guardianCatalog.skillsByName.get(
        build.selectedSkills[slot],
      );
      if (
        !skill?.implemented
        || skill.simulatorExcluded
        || skill.type !== type
      ) {
        errors.push(`${slot} must contain an available ${type} skill.`);
      }
    }
  }
  if (!plainObject(build.gear)) errors.push("gear must be an object.");
  return { valid: errors.length === 0, errors };
}

export function toApplicationBuild(build) {
  const migrated = migrateGuardianBuild(build);
  return {
    ...migrated,
    rotation: migrated.rotation.map(command =>
      toLegacyRotationEntry(command, guardianCatalog)),
  };
}
