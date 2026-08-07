import {
  normalizeRotation,
  toLegacyRotationEntry,
} from "../engine/rotation-commands.js";
import {
  FOOD_NAMES,
  GEAR_SLOTS,
  GEAR_STATS,
  INFUSION_STATS,
  RELIC_NAMES,
  RUNE_NAMES,
  SIGIL_NAMES,
  UTILITY_NAMES,
} from "./gear-data.js";
import { clamp, finiteNumber } from "./numeric.js";
import { normalizeWeaponSigils } from "./weapon-sigils.js";
import type {
  CanonicalCatalog,
  SchedulerRecord,
  Skill,
  SkillId,
} from "../engine/types.js";
import type {
  Gw2ApplicationBuild,
  Gw2BuildCodec,
  Gw2BuildCodecOptions,
  Gw2BuildInfusion,
  Gw2BuildSpecialization,
  Gw2BuildValidationOptions,
  Gw2BuildValidationResult,
  Gw2CanonicalBuild,
} from "./types.js";

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

const GEAR_STATS_BY_NAME = GEAR_STATS as Readonly<Record<string, unknown>>;

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
 * @template {Gw2CanonicalBuild} TBuild
 * @param {Gw2BuildCodecOptions<TBuild>} [options]
 * @returns {Readonly<Gw2BuildCodec<TBuild>>}
 */
export function createGw2BuildCodec<TBuild extends Gw2CanonicalBuild>({
  professionId,
  schemaVersion,
  catalog,
  createDefaults,
  migrations = {},
  normalizeExtra = (build) => build,
  validateExtra = () => [],
  legacyGearAliases = {},
  slotLoadout = null,
}: Gw2BuildCodecOptions<TBuild>): Readonly<Gw2BuildCodec<TBuild>> {
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
  const options: Gw2BuildValidationOptions = {
    professionId,
    schemaVersion,
    catalog,
    slotLoadout,
  };

  function migrateBuild(candidate: unknown): TBuild {
    const saved = migrateVersionedBuild(candidate, {
      professionId,
      schemaVersion,
      migrations,
    });
    const defaults = createDefaults();
    const assumptions = plainObject(saved.assumptions);
    const targetConditions = Object.hasOwn(assumptions, "targetConditions")
      ? plainObject(assumptions.targetConditions)
      : plainObject(defaults.assumptions.targetConditions);
    const legacySigils =
      !Array.isArray(saved.weaponSigils) && Array.isArray(saved.sigils)
        ? [saved.sigils, saved.sigils]
        : saved.weaponSigils;
    const specializations = normalizeSpecializations(
      saved.specializations,
      defaults.specializations,
      catalog,
    );
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
        true,
      ),
      weaponSigils: normalizeWeaponSigils(
        legacySigils as readonly (readonly string[])[] | null | undefined,
        defaults.weaponSigils,
      ),
      rune: listedName(RUNE_NAMES, saved.rune) ? saved.rune : defaults.rune,
      food: listedName(FOOD_NAMES, saved.food) ? saved.food : defaults.food,
      utility: listedName(UTILITY_NAMES, saved.utility)
        ? saved.utility
        : defaults.utility,
      jadeBotCore:
        typeof saved.jadeBotCore === "boolean"
          ? saved.jadeBotCore
          : Boolean(defaults.jadeBotCore),
      specializations,
      selectedSkills: slotLoadout
        ? {
            ...plainObject(defaults.selectedSkills),
            ...plainObject(saved.selectedSkills),
          }
        : normalizeSelectedSkills(saved, defaults, catalog, specializations),
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
    } as unknown as TBuild;
    if (!RELIC_NAMES.includes(migrated.relic)) {
      migrated.relic = defaults.relic;
    }
    migrated = normalizeExtra(migrated, { saved, defaults });
    if (!migrated || typeof migrated !== "object" || Array.isArray(migrated)) {
      throw new TypeError("normalizeExtra must return a build object.");
    }
    migrated.schemaVersion = schemaVersion;
    migrated.profession = professionId;
    if (!migrated.alternateWeapons[0]) {
      migrated.startingWeaponSet = 1;
    }
    if (slotLoadout) {
      const eliteNames = new Set(
        catalog.specializations
          .filter((specialization) => specialization.elite)
          .map((specialization) => specialization.name),
      );
      const specialization =
        migrated.specializations.find((selection) =>
          eliteNames.has(selection.name),
        )?.name || "Core";
      Object.assign(
        migrated,
        slotLoadout.normalizeBuild(migrated, {
          build: migrated,
          specialization,
          catalog,
        }),
      );
    }
    delete migrated.selectedSkillIds;
    delete migrated.sigils;
    return migrated;
  }

  function validateBuild(build: unknown): Gw2BuildValidationResult {
    const common = validateCommonBuild(build, options);
    if (!build || typeof build !== "object" || Array.isArray(build)) {
      return common;
    }
    const extra = validateExtra(build as TBuild);
    const extraErrors = Array.isArray(extra) ? extra : extra?.errors || [];
    const errors = [...common.errors, ...extraErrors.map(String)];
    return { valid: errors.length === 0, errors };
  }

  function toApplicationBuild(build: unknown): Gw2ApplicationBuild {
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

/**
 * @param {unknown} value
 * @returns {value is SchedulerRecord}
 */
function isPlainObject(value: unknown): value is SchedulerRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * @param {unknown} value
 * @returns {SchedulerRecord}
 */
function plainObject(value: unknown): SchedulerRecord {
  return isPlainObject(value) ? value : {};
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * @param {readonly string[]} names
 * @param {unknown} value
 * @returns {value is string}
 */
function listedName(names: readonly string[], value: unknown): value is string {
  return typeof value === "string" && names.includes(value);
}

/** @param {string} professionId */
function professionName(professionId: string): string {
  return professionId.charAt(0).toUpperCase() + professionId.slice(1);
}

/**
 * @param {unknown} value
 * @param {Gw2CanonicalBuild} defaults
 * @param {Readonly<Record<string, string>>} aliases
 * @returns {Record<string, string>}
 */
function normalizeGear(
  value: unknown,
  defaults: Gw2CanonicalBuild,
  aliases: Readonly<Record<string, string>>,
): Record<string, string> {
  const gear = { ...defaults.gear };
  for (const [slot, prefix] of Object.entries(plainObject(value))) {
    if (typeof prefix === "string") gear[slot] = prefix;
  }
  for (const slot of GEAR_SLOTS) {
    gear[slot] = aliases[gear[slot]] || gear[slot];
    if (!GEAR_STATS_BY_NAME[gear[slot]]) gear[slot] = defaults.gear[slot];
  }
  return gear;
}

/**
 * @param {unknown} value
 * @param {readonly string[]} fallback
 * @param {CanonicalCatalog} catalog
 * @param {boolean} [allowEmpty]
 * @returns {string[]}
 */
function normalizeWeaponPair(
  value: unknown,
  fallback: readonly string[],
  catalog: CanonicalCatalog,
  allowEmpty = false,
): string[] {
  if (!Array.isArray(value)) return [...fallback];
  if (allowEmpty && !value[0]) return ["", ""];
  const requestedMain = catalog.weapons.has(value[0]) ? value[0] : "";
  const mainHand = ["mh", "mh+oh", "2h"].includes(
    catalog.weaponHands.get(requestedMain) || "",
  )
    ? requestedMain
    : fallback[0];
  if (catalog.weaponHands.get(mainHand) === "2h") return [mainHand, ""];

  const requestedOff = catalog.weapons.has(value[1]) ? value[1] : "";
  const offHand = ["oh", "mh+oh"].includes(
    catalog.weaponHands.get(requestedOff) || "",
  )
    ? requestedOff
    : fallback[1];
  return [mainHand, offHand];
}

/**
 * @param {unknown} value
 * @param {readonly Gw2BuildSpecialization[]} fallback
 * @param {CanonicalCatalog} catalog
 * @returns {Gw2BuildSpecialization[]}
 */
function normalizeSpecializations(
  value: unknown,
  fallback: readonly Gw2BuildSpecialization[],
  catalog: CanonicalCatalog,
): Gw2BuildSpecialization[] {
  if (!Array.isArray(value)) return clone([...fallback]);
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
      const candidate = plainObject(entry);
      return {
        name: String(candidate.name || ""),
        traits: /^[1-3]-[1-3]-[1-3]$/.test(String(candidate.traits || ""))
          ? String(candidate.traits)
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
  return selected.length === 3 && eliteCount <= 1
    ? selected
    : clone([...fallback]);
}

/**
 * @param {SchedulerRecord} saved
 * @param {CanonicalCatalog} catalog
 * @returns {Record<string, string>}
 */
function selectedSkillsFromLegacy(
  saved: SchedulerRecord,
  catalog: CanonicalCatalog,
): Record<string, string> {
  const result: Record<string, string> = {};
  const skills = (
    Array.isArray(saved.selectedSkillIds) ? saved.selectedSkillIds : []
  )
    .map((id) =>
      typeof id === "string" || typeof id === "number"
        ? catalog.skillsById.get(id)
        : undefined,
    )
    .filter((skill) => skill != null);
  result.Heal = skills.find((skill) => skill.type === "Heal")?.name || "";
  result.Elite = skills.find((skill) => skill.type === "Elite")?.name || "";
  const utilities = skills.filter((skill) => skill.type === "Utility");
  for (let index = 0; index < 3; index += 1) {
    result[`Utility${index + 1}`] = utilities[index]?.name || "";
  }
  return result;
}

/**
 * @param {Skill | null | undefined} skill
 * @param {string} type
 * @param {ReadonlySet<string> | null} [selectedSpecializations]
 */
function selectableSlotSkill(
  skill: Skill | null | undefined,
  type: string,
  selectedSpecializations: ReadonlySet<string> | null = null,
): boolean {
  return Boolean(
    skill?.implemented &&
    skill.slotSelectable !== false &&
    !skill.simulatorExcluded &&
    skill.type === type &&
    skill.flipParentId == null &&
    (!skill.specialization ||
      selectedSpecializations?.has(skill.specialization)),
  );
}

function normalizeSelectedSkills(
  saved: SchedulerRecord,
  defaults: Gw2CanonicalBuild,
  catalog: CanonicalCatalog,
  specializations: readonly Gw2BuildSpecialization[],
): Record<string, string> {
  const source = {
    ...selectedSkillsFromLegacy(saved, catalog),
    ...plainObject(saved.selectedSkills),
  };
  const selectedSpecializations = new Set(
    specializations.map((specialization) => specialization.name),
  );
  const selectedUtilityIds = new Set<SkillId>();
  const normalized: Record<string, string> = {};
  for (const [slot, type] of Object.entries(SLOT_TYPES)) {
    const requestedName = source[slot];
    const requested =
      typeof requestedName === "string"
        ? catalog.skillsByName.get(requestedName)
        : undefined;
    const defaultSkill = catalog.skillsByName.get(
      defaults.selectedSkills[slot],
    );
    const candidates = [requested, defaultSkill, ...catalog.skills];
    const skill = candidates.find(
      (candidate) =>
        candidate != null &&
        selectableSlotSkill(candidate, type, selectedSpecializations) &&
        (type !== "Utility" || !selectedUtilityIds.has(candidate.id)),
    );
    normalized[slot] = skill?.name || "";
    if (type === "Utility" && skill) selectedUtilityIds.add(skill.id);
  }
  return normalized;
}

/**
 * @param {unknown} value
 * @param {readonly import("./types.d.ts").Gw2BuildInfusion[]} fallback
 * @returns {import("./types.d.ts").Gw2BuildInfusion[]}
 */
function normalizeInfusions(
  value: unknown,
  fallback: readonly Gw2BuildInfusion[],
): Gw2BuildInfusion[] {
  if (!Array.isArray(value)) return clone([...fallback]);
  let remaining = 18;
  const infusions = value
    .filter(
      (entry) => isPlainObject(entry) && listedName(INFUSION_STATS, entry.stat),
    )
    .map((entry) => {
      const infusion = entry as SchedulerRecord;
      const count = clamp(
        Math.trunc(Number(infusion.count) || 0),
        0,
        remaining,
      );
      remaining -= count;
      return { stat: infusion.stat as string, count };
    });
  return infusions.length ? infusions : clone([...fallback]);
}

function migrateVersionedBuild(
  candidate: unknown,
  {
    professionId,
    schemaVersion,
    migrations,
  }: {
    readonly professionId: string;
    readonly schemaVersion: number;
    readonly migrations: Readonly<
      Record<number, (saved: SchedulerRecord) => SchedulerRecord>
    >;
  },
): SchedulerRecord {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {};
  }
  const candidateBuild = candidate as SchedulerRecord;
  if (candidateBuild.profession && candidateBuild.profession !== professionId) {
    throw new Error(
      `Cannot load ${candidateBuild.profession} build as ` +
        `${professionName(professionId)}.`,
    );
  }
  let saved = clone(candidateBuild);
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

/**
 * @param {unknown} pair
 * @param {string} label
 * @param {CanonicalCatalog} catalog
 * @param {string[]} errors
 * @param {boolean} [allowEmpty]
 */
function validateWeaponPair(
  pair: unknown,
  label: string,
  catalog: CanonicalCatalog,
  errors: string[],
  allowEmpty = false,
): void {
  if (!Array.isArray(pair) || pair.length !== 2) {
    errors.push(`${label} must contain a main-hand and off-hand slot.`);
    return;
  }
  const [mainHand, offHand] = pair;
  if (allowEmpty && !mainHand && !offHand) return;
  const mainWielding = catalog.weaponHands.get(mainHand);
  const offWielding = offHand ? catalog.weaponHands.get(offHand) : null;
  if (
    !catalog.weapons.has(mainHand) ||
    !["mh", "mh+oh", "2h"].includes(mainWielding || "")
  ) {
    errors.push(`${label} has an invalid main-hand weapon.`);
  }
  if (mainWielding === "2h" && offHand) {
    errors.push(`${mainHand} is two-handed and cannot use ${offHand}.`);
  }
  if (
    offHand &&
    (!catalog.weapons.has(offHand) ||
      !["oh", "mh+oh"].includes(offWielding || ""))
  ) {
    errors.push(`${offHand} cannot be equipped in the off hand.`);
  }
}

/**
 * @param {Gw2CanonicalBuild} build
 * @param {CanonicalCatalog} catalog
 * @param {string} professionId
 * @param {string[]} errors
 */
function validateSpecializations(
  build: Gw2CanonicalBuild,
  catalog: CanonicalCatalog,
  professionId: string,
  errors: string[],
): void {
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
    .filter((specialization) => specialization != null);
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

/**
 * @param {SchedulerRecord} command
 * @param {string} field
 */
function validCanonicalMilliseconds(
  command: SchedulerRecord,
  field: string,
): boolean {
  if (!Object.hasOwn(command, field)) return true;
  const value = Number(command[field]);
  return Number.isFinite(value) && value >= 0;
}

/**
 * @param {unknown} command
 * @param {CanonicalCatalog} catalog
 * @param {string[]} errors
 */
function validateRotationCommand(
  command: unknown,
  catalog: CanonicalCatalog,
  errors: string[],
): void {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    errors.push("rotation contains an invalid canonical command.");
    return;
  }
  const candidate = command as SchedulerRecord;
  if (!["cast", "wait", "combat-start"].includes(String(candidate.type))) {
    errors.push("rotation contains an invalid canonical command.");
    return;
  }
  if (
    !validCanonicalMilliseconds(candidate, "concurrentOffsetMs") ||
    !validCanonicalMilliseconds(candidate, "interruptAfterMs")
  ) {
    errors.push("rotation timing fields must be non-negative numbers.");
  }
  if (
    candidate.type !== "cast" &&
    Object.hasOwn(candidate, "interruptAfterMs")
  ) {
    errors.push("only cast commands may contain interruptAfterMs.");
  }
  if (candidate.type === "wait") {
    if (
      !Object.hasOwn(candidate, "durationMs") ||
      !validCanonicalMilliseconds(candidate, "durationMs")
    ) {
      errors.push("wait commands require a non-negative durationMs.");
    }
    if (Object.hasOwn(candidate, "concurrentOffsetMs")) {
      errors.push("wait commands cannot contain concurrentOffsetMs.");
    }
  }
  if (
    candidate.type === "cast" &&
    (!isSkillId(candidate.skillId) ||
      !catalog.skillsById.has(candidate.skillId))
  ) {
    errors.push(`rotation contains unknown skill ${candidate.skillId}.`);
  }
}

/** @param {unknown} value @returns {value is SkillId} */
function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" || typeof value === "number";
}

/**
 * @param {unknown} build
 * @param {Gw2BuildValidationOptions} validationOptions
 * @returns {Gw2BuildValidationResult}
 */
function validateCommonBuild(
  build: unknown,
  {
    professionId,
    schemaVersion,
    catalog,
    slotLoadout = null,
  }: Gw2BuildValidationOptions,
): Gw2BuildValidationResult {
  const errors: string[] = [];
  if (!build || typeof build !== "object" || Array.isArray(build)) {
    return { valid: false, errors: ["Build must be an object."] };
  }
  const candidate = build as Gw2CanonicalBuild;
  if (candidate.profession !== professionId) {
    errors.push(`profession must be ${professionId}.`);
  }
  if (candidate.schemaVersion !== schemaVersion) {
    errors.push(`schemaVersion must be ${schemaVersion}.`);
  }
  validateWeaponPair(candidate.weapons, "weapons", catalog, errors);
  validateWeaponPair(
    candidate.alternateWeapons,
    "alternateWeapons",
    catalog,
    errors,
    true,
  );
  if (![1, 2].includes(candidate.startingWeaponSet)) {
    errors.push("startingWeaponSet must be 1 or 2.");
  } else if (
    candidate.startingWeaponSet === 2 &&
    !candidate.alternateWeapons?.[0]
  ) {
    errors.push("startingWeaponSet cannot be 2 without a second weapon set.");
  }
  if (!Array.isArray(candidate.rotation)) {
    errors.push("rotation must be an array.");
  } else {
    for (const command of candidate.rotation) {
      validateRotationCommand(command, catalog, errors);
    }
  }
  validateSpecializations(candidate, catalog, professionId, errors);
  if (slotLoadout) {
    const eliteNames = new Set(
      catalog.specializations
        .filter((specialization) => specialization.elite)
        .map((specialization) => specialization.name),
    );
    const specialization =
      (candidate.specializations || []).find((selection) =>
        eliteNames.has(selection?.name),
      )?.name || "Core";
    errors.push(
      ...slotLoadout
        .validateBuild(candidate, {
          build: candidate,
          specialization,
          catalog,
        })
        .map(String),
    );
  } else if (!isPlainObject(candidate.selectedSkills)) {
    errors.push("selectedSkills must be an object.");
  } else {
    const selectedSpecializations = new Set(
      (candidate.specializations || []).map(
        (specialization) => specialization?.name,
      ),
    );
    const selectedUtilityIds = new Set();
    for (const [slot, type] of Object.entries(SLOT_TYPES)) {
      const skill = catalog.skillsByName.get(candidate.selectedSkills[slot]);
      if (
        !selectableSlotSkill(skill, type, selectedSpecializations) ||
        (type === "Utility" && selectedUtilityIds.has(skill?.id))
      ) {
        errors.push(`${slot} must contain an available ${type} skill.`);
      }
      if (type === "Utility" && skill) selectedUtilityIds.add(skill.id);
    }
  }
  if (!isPlainObject(candidate.gear)) {
    errors.push("gear must be an object.");
  } else {
    for (const slot of GEAR_SLOTS) {
      if (!GEAR_STATS_BY_NAME[candidate.gear[slot]]) {
        errors.push(`${slot} must contain a known gear prefix.`);
      }
    }
  }
  if (!listedName(RELIC_NAMES, candidate.relic)) {
    errors.push("relic must be a known relic.");
  }
  if (!listedName(RUNE_NAMES, candidate.rune)) {
    errors.push("rune must be a known rune.");
  }
  if (!listedName(FOOD_NAMES, candidate.food)) {
    errors.push("food must be a known food.");
  }
  if (!listedName(UTILITY_NAMES, candidate.utility)) {
    errors.push("utility must be a known utility consumable.");
  }
  if (typeof candidate.jadeBotCore !== "boolean") {
    errors.push("jadeBotCore must be a boolean.");
  }
  if (
    !Array.isArray(candidate.weaponSigils) ||
    candidate.weaponSigils.length !== 2 ||
    candidate.weaponSigils.some(
      (set) =>
        !Array.isArray(set) ||
        set.length !== 2 ||
        set.some((sigil) => !listedName(SIGIL_NAMES, sigil)) ||
        set[0] === set[1],
    )
  ) {
    errors.push("weaponSigils must contain two valid, unique sigils per set.");
  }
  if (!Array.isArray(candidate.infusions)) {
    errors.push("infusions must be an array.");
  } else {
    let total = 0;
    for (const infusion of candidate.infusions) {
      const count = Number(infusion?.count);
      if (
        !listedName(INFUSION_STATS, infusion?.stat) ||
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
    !Number.isFinite(Number(candidate.targetHealth)) ||
    Number(candidate.targetHealth) < 0
  ) {
    errors.push("targetHealth must be a non-negative number.");
  }
  if (
    !Number.isFinite(Number(candidate.targetArmor)) ||
    Number(candidate.targetArmor) < 1
  ) {
    errors.push("targetArmor must be at least 1.");
  }
  return { valid: errors.length === 0, errors };
}
