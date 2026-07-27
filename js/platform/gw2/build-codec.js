import {
  normalizeRotation,
  toLegacyRotationEntry,
} from "../engine/rotation-commands.js";
import {
  GEAR_SLOTS,
  GEAR_STATS,
  INFUSION_STATS,
  RELIC_NAMES,
  SIGIL_NAMES,
} from "./gear-data.js";
import { normalizeWeaponSigils } from "./weapon-sigils.js";

const SLOT_TYPES = Object.freeze({
  Heal: "Heal",
  Utility1: "Utility",
  Utility2: "Utility",
  Utility3: "Utility",
  Elite: "Elite",
});

const DEFAULT_GEAR_ALIASES = Object.freeze({
  Berserker: "Berserker's",
  Assassin: "Assassin's",
  Viper: "Viper's",
  Dragon: "Dragon's",
  Ritualist: "Ritualist's",
  Trailblazer: "Trailblazer's",
});

/**
 * Creates the common native-profession build persistence contract. Profession
 * configuration owns defaults, version transforms, and additional resources;
 * this codec owns the canonical GW2 build schema.
 *
 * `migrateBuild()` upgrades older schemas one version at a time and then
 * normalizes common fields against the current defaults and profession
 * catalog. It rejects builds for another profession and schema versions newer
 * than this codec. Invalid import values that have safe defaults are sanitized.
 *
 * `validateBuild()` does not migrate or sanitize. It validates a current
 * canonical build and returns `{ valid, errors }`, including errors supplied by
 * `validateExtra`.
 *
 * `toApplicationBuild()` migrates first, then converts canonical stable-ID
 * rotation commands to the name-based compatibility entries consumed by the
 * browser application.
 *
 * @param {Object} [options]
 * @param {string} options.professionId Stable lowercase build profession ID.
 * @param {number} options.schemaVersion Current non-negative schema version.
 * @param {Object} options.catalog Profession catalog. Build normalization uses
 *   `skillsById`, `skillsByName`, `weapons`, `weaponHands`, and
 *   `specializations`.
 * @param {() => Object} options.createDefaults Returns a fresh current build.
 * @param {Object<number, Function>} [options.migrations] Transforms keyed by
 *   their source version. Each transform upgrades one version.
 * @param {Function} [options.normalizeExtra] Profession-specific final
 *   normalizer called as `(build, { saved, defaults }) => build`.
 * @param {Function} [options.validateExtra] Profession-specific validator. It
 *   may return an error array or an object with an `errors` array.
 * @param {Object<string, string>} [options.legacyGearAliases] Additional
 *   legacy gear-prefix aliases.
 * @returns {Object} Frozen codec exposing `migrateBuild`, `validateBuild`, and
 *   `toApplicationBuild`.
 */
export function createGw2BuildCodec({
  professionId,
  schemaVersion,
  catalog,
  createDefaults,
  migrations = {},
  normalizeExtra = (build) => build,
  validateExtra = () => [],
  legacyGearAliases = {},
} = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(String(professionId || ""))) {
    throw new TypeError("Build codec requires a stable professionId.");
  }
  if (!Number.isInteger(schemaVersion) || schemaVersion < 0) {
    throw new TypeError("Build codec requires a non-negative schemaVersion.");
  }
  if (!catalog?.skillsById || typeof createDefaults !== "function") {
    throw new TypeError("Build codec requires a catalog and createDefaults.");
  }
  const aliases = Object.freeze({
    ...DEFAULT_GEAR_ALIASES,
    ...legacyGearAliases,
  });
  const options = {
    professionId,
    schemaVersion,
    catalog,
  };

  function migrateBuild(candidate) {
    const saved = migrateVersionedBuild(candidate, {
      professionId,
      schemaVersion,
      migrations,
    });
    const defaults = createDefaults();
    const assumptions = plainObject(saved.assumptions);
    const targetConditions = Object.hasOwn(assumptions, "targetConditions")
      ? plainObject(assumptions.targetConditions)
      : defaults.assumptions.targetConditions;
    const legacySigils =
      !Array.isArray(saved.weaponSigils) && Array.isArray(saved.sigils)
        ? [saved.sigils, saved.sigils]
        : saved.weaponSigils;
    let migrated = {
      ...defaults,
      ...saved,
      schemaVersion,
      profession: professionId,
      gear: normalizeGear(saved.gear, defaults, aliases),
      weapons: normalizeWeaponPair(saved.weapons, defaults.weapons, catalog),
      alternateWeapons: normalizeWeaponPair(
        saved.alternateWeapons,
        defaults.alternateWeapons,
        catalog,
      ),
      weaponSigils: normalizeWeaponSigils(legacySigils, defaults.weaponSigils),
      specializations: normalizeSpecializations(
        saved.specializations,
        defaults.specializations,
        catalog,
      ),
      selectedSkills: normalizeSelectedSkills(saved, defaults, catalog),
      assumptions: {
        ...defaults.assumptions,
        ...assumptions,
        targetConditions: { ...targetConditions },
      },
      infusions: normalizeInfusions(saved.infusions, defaults.infusions),
      startingWeaponSet: Number(saved.startingWeaponSet) === 2 ? 2 : 1,
      targetHealth: Math.max(
        0,
        finiteNumber(
          saved.targetHealth ?? defaults.targetHealth,
          defaults.targetHealth,
        ),
      ),
      targetArmor: Math.max(
        1,
        finiteNumber(
          saved.targetArmor ?? defaults.targetArmor,
          defaults.targetArmor,
        ),
      ),
      rotation: normalizeRotation(saved.rotation, catalog),
    };
    if (!RELIC_NAMES.includes(migrated.relic)) {
      migrated.relic = defaults.relic;
    }
    migrated = normalizeExtra(migrated, { saved, defaults });
    if (!migrated || typeof migrated !== "object" || Array.isArray(migrated)) {
      throw new TypeError("normalizeExtra must return a build object.");
    }
    migrated.schemaVersion = schemaVersion;
    migrated.profession = professionId;
    delete migrated.selectedSkillIds;
    delete migrated.sigils;
    return migrated;
  }

  function validateBuild(build) {
    const common = validateCommonBuild(build, options);
    if (!build || typeof build !== "object" || Array.isArray(build)) {
      return common;
    }
    const extra = validateExtra(build);
    const extraErrors = Array.isArray(extra) ? extra : extra?.errors || [];
    const errors = [...common.errors, ...extraErrors.map(String)];
    return { valid: errors.length === 0, errors };
  }

  function toApplicationBuild(build) {
    const migrated = migrateBuild(build);
    return {
      ...migrated,
      rotation: migrated.rotation.map((command) =>
        toLegacyRotationEntry(command, catalog),
      ),
    };
  }

  return Object.freeze({
    migrateBuild,
    validateBuild,
    toApplicationBuild,
  });
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function plainObject(value) {
  return isPlainObject(value) ? value : {};
}

function clone(value) {
  return structuredClone(value);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function professionName(professionId) {
  return professionId.charAt(0).toUpperCase() + professionId.slice(1);
}

function normalizeGear(value, defaults, aliases) {
  const gear = {
    ...defaults.gear,
    ...plainObject(value),
  };
  for (const slot of GEAR_SLOTS) {
    gear[slot] = aliases[gear[slot]] || gear[slot];
    if (!GEAR_STATS[gear[slot]]) gear[slot] = defaults.gear[slot];
  }
  return gear;
}

function normalizeWeaponPair(value, fallback, catalog) {
  if (!Array.isArray(value)) return [...fallback];
  const requestedMain = catalog.weapons.has(value[0]) ? value[0] : "";
  const mainHand = ["mh", "mh+oh", "2h"].includes(
    catalog.weaponHands.get(requestedMain),
  )
    ? requestedMain
    : fallback[0];
  if (catalog.weaponHands.get(mainHand) === "2h") return [mainHand, ""];

  const requestedOff = catalog.weapons.has(value[1]) ? value[1] : "";
  const offHand = ["oh", "mh+oh"].includes(
    catalog.weaponHands.get(requestedOff),
  )
    ? requestedOff
    : fallback[1];
  return [mainHand, offHand];
}

function normalizeSpecializations(value, fallback, catalog) {
  if (!Array.isArray(value)) return clone(fallback);
  const known = new Map(
    catalog.specializations.map((specialization) => [
      specialization.name,
      specialization,
    ]),
  );
  const selected = value
    .slice(0, 3)
    .map((entry) => {
      if (typeof entry === "string") {
        return { name: entry, traits: "1-1-1" };
      }
      return {
        name: String(entry?.name || ""),
        traits: /^[1-3]-[1-3]-[1-3]$/.test(String(entry?.traits || ""))
          ? String(entry.traits)
          : "1-1-1",
      };
    })
    .filter((entry) => known.has(entry.name))
    .filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.name === entry.name) ===
        index,
    );
  const eliteCount = selected.filter(
    (entry) => known.get(entry.name)?.elite,
  ).length;
  return selected.length === 3 && eliteCount <= 1 ? selected : clone(fallback);
}

function selectedSkillsFromLegacy(saved, catalog) {
  const result = {};
  const skills = (
    Array.isArray(saved.selectedSkillIds) ? saved.selectedSkillIds : []
  )
    .map((id) => catalog.skillsById.get(id))
    .filter(Boolean);
  result.Heal = skills.find((skill) => skill.type === "Heal")?.name;
  result.Elite = skills.find((skill) => skill.type === "Elite")?.name;
  const utilities = skills.filter((skill) => skill.type === "Utility");
  for (let index = 0; index < 3; index += 1) {
    result[`Utility${index + 1}`] = utilities[index]?.name;
  }
  return result;
}

function selectableSlotSkill(skill, type) {
  return Boolean(
    skill?.implemented &&
    !skill.simulatorExcluded &&
    skill.type === type &&
    skill.flipParentId == null,
  );
}

function normalizeSelectedSkills(saved, defaults, catalog) {
  const source = {
    ...selectedSkillsFromLegacy(saved, catalog),
    ...plainObject(saved.selectedSkills),
  };
  return Object.fromEntries(
    Object.entries(SLOT_TYPES).map(([slot, type]) => {
      const candidate = catalog.skillsByName.get(source[slot]);
      const fallback = catalog.skillsByName.get(defaults.selectedSkills[slot]);
      const skill = selectableSlotSkill(candidate, type) ? candidate : fallback;
      return [slot, skill?.name || ""];
    }),
  );
}

function normalizeInfusions(value, fallback) {
  if (!Array.isArray(value)) return clone(fallback);
  let remaining = 18;
  const infusions = value
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        INFUSION_STATS.includes(entry.stat),
    )
    .map((entry) => {
      const count = Math.max(
        0,
        Math.min(remaining, Math.trunc(Number(entry.count) || 0)),
      );
      remaining -= count;
      return { stat: entry.stat, count };
    });
  return infusions.length ? infusions : clone(fallback);
}

function migrateVersionedBuild(
  candidate,
  { professionId, schemaVersion, migrations },
) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {};
  }
  if (candidate.profession && candidate.profession !== professionId) {
    throw new Error(
      `Cannot load ${candidate.profession} build as ` +
        `${professionName(professionId)}.`,
    );
  }
  let saved = clone(candidate);
  let version = Number(saved.schemaVersion ?? 0);
  if (!Number.isInteger(version) || version < 0 || version > schemaVersion) {
    throw new Error(`Unsupported build schema version: ${saved.schemaVersion}`);
  }
  while (version < schemaVersion) {
    const migrate = migrations[version];
    saved =
      typeof migrate === "function"
        ? migrate(saved)
        : { ...saved, schemaVersion: version + 1 };
    version += 1;
    saved.schemaVersion = version;
  }
  return saved;
}

function validateWeaponPair(pair, label, catalog, errors) {
  if (!Array.isArray(pair) || pair.length !== 2) {
    errors.push(`${label} must contain a main-hand and off-hand slot.`);
    return;
  }
  const [mainHand, offHand] = pair;
  const mainWielding = catalog.weaponHands.get(mainHand);
  const offWielding = offHand ? catalog.weaponHands.get(offHand) : null;
  if (
    !catalog.weapons.has(mainHand) ||
    !["mh", "mh+oh", "2h"].includes(mainWielding)
  ) {
    errors.push(`${label} has an invalid main-hand weapon.`);
  }
  if (mainWielding === "2h" && offHand) {
    errors.push(`${mainHand} is two-handed and cannot use ${offHand}.`);
  }
  if (
    offHand &&
    (!catalog.weapons.has(offHand) || !["oh", "mh+oh"].includes(offWielding))
  ) {
    errors.push(`${offHand} cannot be equipped in the off hand.`);
  }
}

function validateSpecializations(build, catalog, professionId, errors) {
  if (!Array.isArray(build.specializations)) {
    errors.push("specializations must be an array.");
    return;
  }
  const known = new Map(
    catalog.specializations.map((specialization) => [
      specialization.name,
      specialization,
    ]),
  );
  const selected = build.specializations
    .map((specialization) => known.get(specialization?.name))
    .filter(Boolean);
  if (selected.length !== build.specializations.length) {
    errors.push(
      `specializations contain an unknown ${professionName(professionId)} line.`,
    );
  }
  if (selected.filter((specialization) => specialization.elite).length > 1) {
    errors.push("only one elite specialization can be selected.");
  }
  if (
    new Set(selected.map((specialization) => specialization.name)).size !==
    selected.length
  ) {
    errors.push("specializations cannot contain duplicates.");
  }
  if (
    build.specializations.some(
      (specialization) =>
        !/^[1-3]-[1-3]-[1-3]$/.test(String(specialization?.traits || "")),
    )
  ) {
    errors.push("specialization traits must use the 1-1-1 selection format.");
  }
  if (build.specializations.length !== 3) {
    errors.push("exactly three specializations must be selected.");
  }
}

function validateCommonBuild(build, { professionId, schemaVersion, catalog }) {
  const errors = [];
  if (!build || typeof build !== "object" || Array.isArray(build)) {
    return { valid: false, errors: ["Build must be an object."] };
  }
  if (build.profession !== professionId) {
    errors.push(`profession must be ${professionId}.`);
  }
  if (build.schemaVersion !== schemaVersion) {
    errors.push(`schemaVersion must be ${schemaVersion}.`);
  }
  validateWeaponPair(build.weapons, "weapons", catalog, errors);
  validateWeaponPair(
    build.alternateWeapons,
    "alternateWeapons",
    catalog,
    errors,
  );
  if (![1, 2].includes(build.startingWeaponSet)) {
    errors.push("startingWeaponSet must be 1 or 2.");
  }
  if (!Array.isArray(build.rotation)) {
    errors.push("rotation must be an array.");
  } else {
    for (const command of build.rotation) {
      if (
        !command ||
        typeof command !== "object" ||
        !["cast", "wait", "combat-start"].includes(command.type)
      ) {
        errors.push("rotation contains an invalid canonical command.");
        continue;
      }
      if (command.type === "cast" && !catalog.skillsById.has(command.skillId)) {
        errors.push(`rotation contains unknown skill ${command.skillId}.`);
      }
    }
  }
  validateSpecializations(build, catalog, professionId, errors);
  if (!isPlainObject(build.selectedSkills)) {
    errors.push("selectedSkills must be an object.");
  } else {
    for (const [slot, type] of Object.entries(SLOT_TYPES)) {
      const skill = catalog.skillsByName.get(build.selectedSkills[slot]);
      if (!selectableSlotSkill(skill, type)) {
        errors.push(`${slot} must contain an available ${type} skill.`);
      }
    }
  }
  if (!isPlainObject(build.gear)) {
    errors.push("gear must be an object.");
  } else {
    for (const slot of GEAR_SLOTS) {
      if (!GEAR_STATS[build.gear[slot]]) {
        errors.push(`${slot} must contain a known gear prefix.`);
      }
    }
  }
  if (!RELIC_NAMES.includes(build.relic)) {
    errors.push("relic must be a known relic.");
  }
  if (
    !Array.isArray(build.weaponSigils) ||
    build.weaponSigils.length !== 2 ||
    build.weaponSigils.some(
      (set) =>
        !Array.isArray(set) ||
        set.length !== 2 ||
        set.some((sigil) => !SIGIL_NAMES.includes(sigil)) ||
        set[0] === set[1],
    )
  ) {
    errors.push("weaponSigils must contain two valid, unique sigils per set.");
  }
  if (!Array.isArray(build.infusions)) {
    errors.push("infusions must be an array.");
  } else {
    let total = 0;
    for (const infusion of build.infusions) {
      const count = Number(infusion?.count);
      if (
        !INFUSION_STATS.includes(infusion?.stat) ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > 18
      ) {
        errors.push("infusions contain an invalid stat or count.");
        break;
      }
      total += count;
    }
    if (total > 18) errors.push("infusion count cannot exceed 18.");
  }
  if (
    !Number.isFinite(Number(build.targetHealth)) ||
    Number(build.targetHealth) < 0
  ) {
    errors.push("targetHealth must be a non-negative number.");
  }
  if (
    !Number.isFinite(Number(build.targetArmor)) ||
    Number(build.targetArmor) < 1
  ) {
    errors.push("targetArmor must be at least 1.");
  }
  return { valid: errors.length === 0, errors };
}
