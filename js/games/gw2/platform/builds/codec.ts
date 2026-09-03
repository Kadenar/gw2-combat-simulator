import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { canonicalGw2SkillId } from '#gw2/platform/skills/aliases.js';
import { FOOD_NAMES } from '#gw2/platform/equipment/consumables/food.js';
import { GEAR_SLOTS, GEAR_STATS, INFUSION_STATS } from '#gw2/platform/equipment/gear/stats.js';
import { RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import { RUNE_NAMES } from '#gw2/platform/equipment/gear/runes.js';
import { SIGIL_NAMES } from '#gw2/platform/equipment/sigils/data.js';
import { UTILITY_NAMES } from '#gw2/platform/equipment/consumables/utilities.js';
import { clamp, finiteNumber } from '#gw2/platform/combat/numeric.js';
import { boundedInteger, boundedNumber, enumValue } from '#gw2/platform/builds/normalization.js';
import { normalizeCommonAssumptions, validateCommonAssumptions } from '#gw2/platform/builds/assumptions.js';
import { normalizeWeaponSigils } from '#gw2/platform/equipment/sigils/loadout.js';
import type { CanonicalCatalog, SchedulerRecord, Skill, SkillId } from '#gw2/platform/engine/types.js';
import type {
  Gw2ApplicationBuild,
  Gw2BuildCodec,
  Gw2BuildCodecOptions,
  Gw2BuildExtraFieldDescriptor,
  Gw2BuildExtraFieldDescriptors,
  Gw2BuildInfusion,
  Gw2BuildSpecialization,
  Gw2BuildValidationOptions,
  Gw2BuildValidationResult,
  Gw2CanonicalBuild
} from '#gw2/platform/builds/types.js';

const SLOT_TYPES = Object.freeze({
  Heal: 'Heal',
  Utility1: 'Utility',
  Utility2: 'Utility',
  Utility3: 'Utility',
  Elite: 'Elite'
});

const DEFAULT_GEAR_ALIASES = Object.freeze({
  Berserker: "Berserker's",
  Assassin: "Assassin's",
  Viper: "Viper's",
  Dragon: "Dragon's",
  Ritualist: "Ritualist's",
  Trailblazer: "Trailblazer's"
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
 * `toApplicationBuild()` migrates and normalizes an unknown candidate into the
 * canonical build shape consumed by the browser application.
 */
export function createGw2BuildCodec<TBuild extends Gw2CanonicalBuild>({
  professionId,
  schemaVersion,
  catalog,
  createDefaults,
  migrations = {},
  extraFields = {} as Gw2BuildExtraFieldDescriptors<TBuild>,
  normalizeExtra = (build) => build,
  validateExtra = () => [],
  legacyGearAliases = {},
  slotLoadout = null
}: Gw2BuildCodecOptions<TBuild>): Readonly<Gw2BuildCodec<TBuild>> {
  if (!/^[a-z][a-z0-9-]*$/.test(String(professionId || ''))) {
    throw new TypeError('Build codec requires a stable professionId.');
  }

  if (!Number.isInteger(schemaVersion) || schemaVersion < 0) {
    throw new TypeError('Build codec requires a non-negative schemaVersion.');
  }

  if (!catalog?.skillsById || typeof createDefaults !== 'function') {
    throw new TypeError('Build codec requires a catalog and createDefaults.');
  }

  validateExtraFieldDescriptors(extraFields);

  const aliases = Object.freeze({
    ...DEFAULT_GEAR_ALIASES,
    ...legacyGearAliases
  });
  const options: Gw2BuildValidationOptions = {
    professionId,
    schemaVersion,
    catalog,
    slotLoadout
  };

  function migrateBuild(candidate: unknown): TBuild {
    const saved = migrateVersionedBuild(candidate, {
      professionId,
      schemaVersion,
      migrations
    });
    const defaults = createDefaults();
    const assumptions = normalizeCommonAssumptions(plainObject(saved.assumptions), plainObject(defaults.assumptions));
    // Only inherit saved targetConditions when the key is explicitly present;
    // a partial assumptions object must not silently drop target condition defaults.
    const targetConditions = Object.hasOwn(assumptions, 'targetConditions')
      ? plainObject(assumptions.targetConditions)
      : plainObject(defaults.assumptions.targetConditions);
    // Old builds stored a single sigils array shared by both weapon sets.
    // Duplicate it into the two-weapon-set format so downstream code is uniform.
    const legacySigils =
      !Array.isArray(saved.weaponSigils) && Array.isArray(saved.sigils)
        ? [saved.sigils, saved.sigils]
        : saved.weaponSigils;
    const specializations = normalizeSpecializations(saved.specializations, defaults.specializations, catalog);
    const gear = normalizeGear(saved.gear, defaults, aliases);
    let migrated = {
      ...defaults,
      ...saved,
      schemaVersion,
      profession: professionId,
      gear,
      // Fall back to main weapon gear prefix if alternateWeaponPrefixes is missing.
      alternateWeaponPrefixes: normalizeWeaponPrefixes(
        saved.alternateWeaponPrefixes,
        [gear.Weapon1, gear.Weapon2],
        aliases
      ),
      weapons: normalizeWeaponPair(saved.weapons, defaults.weapons, catalog),
      // Second weapon set is optional; allowEmpty=true lets both slots be "".
      alternateWeapons: normalizeWeaponPair(saved.alternateWeapons, defaults.alternateWeapons, catalog, true),
      weaponSigils: normalizeWeaponSigils(
        legacySigils as readonly (readonly string[])[] | null | undefined,
        defaults.weaponSigils
      ),
      rune: listedName(RUNE_NAMES, saved.rune) ? saved.rune : defaults.rune,
      food: listedName(FOOD_NAMES, saved.food) ? saved.food : defaults.food,
      utility: listedName(UTILITY_NAMES, saved.utility) ? saved.utility : defaults.utility,
      jadeBotCore: typeof saved.jadeBotCore === 'boolean' ? saved.jadeBotCore : Boolean(defaults.jadeBotCore),
      specializations,
      // Slot-loadout professions manage their own skill-slot logic; bypass
      // catalog validation and just merge saved values over defaults.
      selectedSkills: slotLoadout
        ? {
            ...plainObject(defaults.selectedSkills),
            ...plainObject(saved.selectedSkills)
          }
        : normalizeSelectedSkills(saved, defaults, catalog, specializations),
      assumptions: {
        ...defaults.assumptions,
        ...assumptions,
        targetConditions: { ...targetConditions }
      },
      infusions: normalizeInfusions(saved.infusions, defaults.infusions),
      // Any value other than exactly 2 collapses to 1.
      startingWeaponSet: Number(saved.startingWeaponSet) === 2 ? 2 : 1,
      targetHealth: Math.max(0, finiteNumber(saved.targetHealth ?? defaults.targetHealth, defaults.targetHealth)),
      targetStartingHealthPercent: clamp(
        finiteNumber(
          saved.targetStartingHealthPercent ?? defaults.targetStartingHealthPercent,
          defaults.targetStartingHealthPercent
        ),
        0,
        100
      ),
      targetArmor: Math.max(1, finiteNumber(saved.targetArmor ?? defaults.targetArmor, defaults.targetArmor)),
      rotation: normalizeRotation(saved.rotation, catalog)
    } as unknown as TBuild;
    // relic validation happens after the spread because it is not part of the
    // normalizeGear flow and may have been overwritten by the saved spread above.
    if (!RELIC_NAMES.includes(migrated.relic)) {
      migrated.relic = defaults.relic;
    }

    // Extra-field descriptors apply the same bounds and enum vocabulary used
    // by validation before profession-specific migration or repair hooks run.
    migrated = normalizeExtraBuildFields(migrated, saved, defaults, extraFields);
    migrated = normalizeExtra(migrated, { saved, defaults });
    if (!migrated || typeof migrated !== 'object' || Array.isArray(migrated)) {
      throw new TypeError('normalizeExtra must return a build object.');
    }

    // Re-stamp after normalizeExtra so a buggy hook can't change the identity fields.
    migrated.schemaVersion = schemaVersion;
    migrated.profession = professionId;
    // Can't start on set 2 if no second weapon set was saved.
    if (!migrated.alternateWeapons[0]) {
      migrated.startingWeaponSet = 1;
    }

    if (slotLoadout) {
      // Determine which elite spec is active (or "Core") so the slot-loadout
      // system can pick the correct skill palette for that specialization.
      const eliteNames = new Set(
        catalog.specializations
          .filter((specialization) => specialization.elite)
          .map((specialization) => specialization.name)
      );
      const specialization =
        migrated.specializations.find((selection) => eliteNames.has(selection.name))?.name || 'Core';
      Object.assign(
        migrated,
        slotLoadout.normalizeBuild(migrated, {
          build: migrated,
          specialization,
          catalog
        })
      );
    }

    // Strip legacy fields so they don't leak into the canonical output.
    delete migrated.selectedSkillIds;
    delete migrated.sigils;
    return migrated;
  }

  function validateBuild(build: unknown): Gw2BuildValidationResult {
    const common = validateCommonBuild(build, options);
    if (!build || typeof build !== 'object' || Array.isArray(build)) {
      return common;
    }

    const descriptorErrors = validateExtraBuildFields(build as TBuild, extraFields);
    const extra = validateExtra(build as TBuild);
    const extraErrors = Array.isArray(extra) ? extra : extra?.errors || [];
    const errors = [...common.errors, ...descriptorErrors, ...extraErrors.map(String)];
    return { valid: errors.length === 0, errors };
  }

  function toApplicationBuild(build: unknown): Gw2ApplicationBuild {
    const migrated = migrateBuild(build);
    // Application state now shares the canonical command model produced by migration.
    return migrated;
  }

  return Object.freeze({
    migrateBuild,
    validateBuild,
    toApplicationBuild
  });
}

/**
 * Fails fast when a codec declares unusable field bounds or an empty enum so
 * persisted builds cannot be normalized against an ambiguous contract.
 */
function validateExtraFieldDescriptors<TBuild extends Gw2CanonicalBuild>(
  descriptors: Gw2BuildExtraFieldDescriptors<TBuild>
): void {
  for (const [field, descriptor] of Object.entries(descriptors) as [string, Gw2BuildExtraFieldDescriptor][]) {
    if (!descriptor || !['number', 'integer', 'enum'].includes(descriptor.type)) {
      throw new TypeError(`Extra build field ${field} requires a supported descriptor type.`);
    }

    if (descriptor.type === 'enum') {
      if (!descriptor.values.length || descriptor.values.some((value) => typeof value !== 'string')) {
        throw new TypeError(`Extra build field ${field} requires at least one string enum value.`);
      }

      continue;
    }

    if (
      !Number.isFinite(descriptor.minimum) ||
      !Number.isFinite(descriptor.maximum) ||
      descriptor.minimum > descriptor.maximum
    ) {
      throw new TypeError(`Extra build field ${field} requires finite, ordered bounds.`);
    }
  }
}

/**
 * Normalizes declarative profession fields from their persisted values while
 * taking missing-value defaults from the profession's canonical build.
 */
function normalizeExtraBuildFields<TBuild extends Gw2CanonicalBuild>(
  build: TBuild,
  saved: SchedulerRecord,
  defaults: TBuild,
  descriptors: Gw2BuildExtraFieldDescriptors<TBuild>
): TBuild {
  const normalized: SchedulerRecord = { ...build };
  for (const [field, descriptor] of Object.entries(descriptors) as [string, Gw2BuildExtraFieldDescriptor][]) {
    const configuredDefault = descriptor.defaultValue ?? defaults[field];
    const value = saved[field] ?? configuredDefault;
    if (descriptor.type === 'number') {
      normalized[field] = boundedNumber(value, Number(configuredDefault), descriptor.minimum, descriptor.maximum);
    } else if (descriptor.type === 'integer') {
      normalized[field] = boundedInteger(value, Number(configuredDefault), descriptor.minimum, descriptor.maximum);
    } else {
      const fallback = enumValue(configuredDefault, descriptor.values, descriptor.values[0]);
      normalized[field] = enumValue(value, descriptor.values, fallback);
    }
  }

  return normalized as TBuild;
}

/**
 * Validates canonical profession fields with the same descriptors used during
 * migration so range and enum contracts cannot drift into separate rules.
 */
function validateExtraBuildFields<TBuild extends Gw2CanonicalBuild>(
  build: TBuild,
  descriptors: Gw2BuildExtraFieldDescriptors<TBuild>
): string[] {
  const errors: string[] = [];
  for (const [field, descriptor] of Object.entries(descriptors) as [string, Gw2BuildExtraFieldDescriptor][]) {
    const value = build[field];
    let valid = false;
    if (descriptor.type === 'enum') {
      valid = typeof value === 'string' && descriptor.values.includes(value);
    } else {
      const numeric = Number(value);
      valid =
        Number.isFinite(numeric) &&
        numeric >= descriptor.minimum &&
        numeric <= descriptor.maximum &&
        (descriptor.type !== 'integer' || Number.isInteger(numeric));
    }

    if (valid) continue;
    const label = descriptor.label || field;
    errors.push(
      descriptor.validationMessage ||
        (descriptor.type === 'enum'
          ? `${label} must be one of ${descriptor.values.join(', ')}.`
          : `${label} must be between ${descriptor.minimum} and ${descriptor.maximum}.`)
    );
  }

  return errors;
}

function isPlainObject(value: unknown): value is SchedulerRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function plainObject(value: unknown): SchedulerRecord {
  return isPlainObject(value) ? value : {};
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function listedName(names: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && names.includes(value);
}

function professionName(professionId: string): string {
  return professionId.charAt(0).toUpperCase() + professionId.slice(1);
}

function normalizeGear(
  value: unknown,
  defaults: Gw2CanonicalBuild,
  aliases: Readonly<Record<string, string>>
): Record<string, string> {
  // Start from defaults so unrecognised or missing slots keep a valid prefix.
  const gear = { ...defaults.gear };
  for (const [slot, prefix] of Object.entries(plainObject(value))) {
    if (typeof prefix === 'string') gear[slot] = prefix;
  }

  for (const slot of GEAR_SLOTS) {
    // Resolve abbreviated names ("Berserker" → "Berserker's") before lookup.
    gear[slot] = aliases[gear[slot]] || gear[slot];
    // If the resolved prefix still isn't a known stat, fall back to the default.
    if (!GEAR_STATS_BY_NAME[gear[slot]]) gear[slot] = defaults.gear[slot];
  }

  return gear;
}

function normalizeWeaponPrefixes(
  value: unknown,
  fallback: readonly string[],
  aliases: Readonly<Record<string, string>>
): string[] {
  const prefixes = Array.isArray(value) ? value : fallback;
  return [0, 1].map((index) => {
    const prefix = aliases[String(prefixes[index] || '')] || prefixes[index];
    return typeof prefix === 'string' && GEAR_STATS_BY_NAME[prefix] ? prefix : fallback[index];
  });
}

function normalizeWeaponPair(
  value: unknown,
  fallback: readonly string[],
  catalog: CanonicalCatalog,
  allowEmpty = false
): string[] {
  if (!Array.isArray(value)) return [...fallback];
  // allowEmpty=true means "no second weapon set" is a valid state.
  if (allowEmpty && !value[0]) return ['', ''];
  // "mh+oh" weapons (e.g. torch) can fill either slot; only "oh"-only weapons
  // are excluded from the main hand.
  const requestedMain = catalog.weapons.has(value[0]) ? value[0] : '';
  const mainHand = ['mh', 'mh+oh', '2h'].includes(catalog.weaponHands.get(requestedMain) || '')
    ? requestedMain
    : fallback[0];
  // Two-handed weapons have no off-hand slot.
  if (catalog.weaponHands.get(mainHand) === '2h') return [mainHand, ''];

  const requestedOff = catalog.weapons.has(value[1]) ? value[1] : '';
  const offHand = ['oh', 'mh+oh'].includes(catalog.weaponHands.get(requestedOff) || '') ? requestedOff : fallback[1];
  return [mainHand, offHand];
}

function normalizeSpecializations(
  value: unknown,
  fallback: readonly Gw2BuildSpecialization[],
  catalog: CanonicalCatalog
): Gw2BuildSpecialization[] {
  if (!Array.isArray(value)) return clone([...fallback]);
  const known = new Map(catalog.specializations.map((specialization) => [specialization.name, specialization]));
  const selected = value
    .slice(0, 3)
    .map((entry) => {
      // Accept a bare string as shorthand for { name, traits: "1-1-1" }.
      if (typeof entry === 'string') {
        return { name: entry, traits: '1-1-1' };
      }

      const candidate = plainObject(entry);
      return {
        name: String(candidate.name || ''),
        // Invalid or missing trait selection resets to tier-1 across all columns.
        traits: /^[1-3]-[1-3]-[1-3]$/.test(String(candidate.traits || '')) ? String(candidate.traits) : '1-1-1'
      };
    })
    .filter((entry) => known.has(entry.name))
    // Keep only the first occurrence of each specialization line.
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.name === entry.name) === index);
  const eliteCount = selected.filter((entry) => known.get(entry.name)?.elite).length;
  // The entire selection must be exactly 3 lines with at most one elite;
  // any violation falls back to defaults rather than partial normalization.
  return selected.length === 3 && eliteCount <= 1 ? selected : clone([...fallback]);
}

// Older builds stored skill IDs instead of names. Canonicalize numeric aliases
// before catalog lookup so deleted compatibility records still migrate.
function selectedSkillsFromLegacy(saved: SchedulerRecord, catalog: CanonicalCatalog): Record<string, string> {
  const result: Record<string, string> = {};
  const skills = (Array.isArray(saved.selectedSkillIds) ? saved.selectedSkillIds : [])
    .map((id) =>
      typeof id === 'string' || typeof id === 'number' ? catalog.skillsById.get(canonicalGw2SkillId(id)) : undefined
    )
    .filter((skill) => skill != null);
  result.Heal = skills.find((skill) => skill.type === 'Heal')?.name || '';
  result.Elite = skills.find((skill) => skill.type === 'Elite')?.name || '';
  const utilities = skills.filter((skill) => skill.type === 'Utility');
  for (let index = 0; index < 3; index += 1) {
    result[`Utility${index + 1}`] = utilities[index]?.name || '';
  }

  return result;
}

function selectableSlotSkill(
  skill: Skill | null | undefined,
  type: string,
  selectedSpecializations: ReadonlySet<string> | null = null
): boolean {
  return Boolean(
    skill &&
    skill.slotSelectable !== false &&
    !skill.simulatorExcluded &&
    skill.type === type &&
    // Exclude flip/chain skills (e.g. the follow-up hit of a two-stage
    // attack); only the root skill can appear in the loadout panel.
    skill.flipParentId == null &&
    // Elite-spec skills are only available when that spec line is selected.
    (!skill.specialization || selectedSpecializations?.has(skill.specialization))
  );
}

function normalizeSelectedSkills(
  saved: SchedulerRecord,
  defaults: Gw2CanonicalBuild,
  catalog: CanonicalCatalog,
  specializations: readonly Gw2BuildSpecialization[]
): Record<string, string> {
  // Legacy ID-based format is overlaid first so that the newer name-based
  // selectedSkills field takes precedence when both are present.
  const source = {
    ...selectedSkillsFromLegacy(saved, catalog),
    ...plainObject(saved.selectedSkills)
  };
  const selectedSpecializations = new Set(specializations.map((specialization) => specialization.name));
  const selectedUtilityIds = new Set<SkillId>();
  const normalized: Record<string, string> = {};
  for (const [slot, type] of Object.entries(SLOT_TYPES)) {
    const requestedName = source[slot];
    const requested = typeof requestedName === 'string' ? catalog.skillsByName.get(requestedName) : undefined;
    const defaultSkill = catalog.skillsByName.get(defaults.selectedSkills[slot]);
    // Priority: user's saved pick → profession default → first valid in catalog.
    // This ensures a slot is never left empty as long as any valid skill exists.
    const candidates = [requested, defaultSkill, ...catalog.skills];
    const skill = candidates.find(
      (candidate) =>
        candidate != null &&
        selectableSlotSkill(candidate, type, selectedSpecializations) &&
        // Prevent the same utility from filling two slots.
        (type !== 'Utility' || !selectedUtilityIds.has(candidate.id))
    );
    normalized[slot] = skill?.name || '';
    if (type === 'Utility' && skill) selectedUtilityIds.add(skill.id);
  }

  return normalized;
}

function normalizeInfusions(value: unknown, fallback: readonly Gw2BuildInfusion[]): Gw2BuildInfusion[] {
  if (!Array.isArray(value)) return clone([...fallback]);
  // remaining tracks the budget across entries so total count never exceeds 18.
  let remaining = 18;
  const infusions = value
    .filter((entry) => isPlainObject(entry) && listedName(INFUSION_STATS, entry.stat))
    .map((entry) => {
      const infusion = entry as SchedulerRecord;
      // Clamp each entry against the remaining budget rather than rejecting it,
      // so partially valid saves degrade gracefully.
      const count = clamp(Math.trunc(Number(infusion.count) || 0), 0, remaining);
      remaining -= count;
      return { stat: infusion.stat as string, count };
    });
  // If no valid entries survived filtering, the whole list is unreadable;
  // fall back to defaults rather than returning an empty array.
  if (!infusions.length) return clone([...fallback]);
  // Ensure the canonical stat rows are always present (count 0 when absent)
  // so the gear panel never collapses to a single infusion type.
  const present = new Set(infusions.map((infusion) => infusion.stat));
  for (const entry of fallback) {
    if (!present.has(entry.stat)) {
      infusions.push({ stat: entry.stat, count: 0 });
      present.add(entry.stat);
    }
  }

  return infusions;
}

/**
 * Deep-clones the candidate and applies numbered migration functions in order
 * until `schemaVersion` is reached. Throws for wrong profession or an
 * unrecognized (future) schema version. Missing migration steps are skipped
 * by bumping `schemaVersion` without transforming the data.
 */
function migrateVersionedBuild(
  candidate: unknown,
  {
    professionId,
    schemaVersion,
    migrations
  }: {
    readonly professionId: string;
    readonly schemaVersion: number;
    readonly migrations: Readonly<Record<number, (saved: SchedulerRecord) => SchedulerRecord>>;
  }
): SchedulerRecord {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {};
  }

  const candidateBuild = candidate as SchedulerRecord;
  // A missing profession field is treated as matching (e.g. very old saves);
  // a present but wrong profession is a hard error to prevent silent data corruption.
  if (candidateBuild.profession && candidateBuild.profession !== professionId) {
    throw new Error(`Cannot load ${candidateBuild.profession} build as ` + `${professionName(professionId)}.`);
  }

  // Clone before mutating so the original candidate object is never modified.
  let saved = clone(candidateBuild);
  let version = Number(saved.schemaVersion ?? 0);
  // A version newer than this codec would need transforms we don't have yet.
  if (!Number.isInteger(version) || version < 0 || version > schemaVersion) {
    throw new Error(`Unsupported build schema version: ${saved.schemaVersion}`);
  }

  while (version < schemaVersion) {
    const migrate = migrations[version];
    // If no migration function is registered for a version gap, just bump
    // the version; normalizeGear/normalizeWeaponPair etc. handle the rest.
    saved = typeof migrate === 'function' ? migrate(saved) : { ...saved, schemaVersion: version + 1 };
    version += 1;
    saved.schemaVersion = version;
  }

  return saved;
}

function validateWeaponPair(
  pair: unknown,
  label: string,
  catalog: CanonicalCatalog,
  errors: string[],
  allowEmpty = false
): void {
  if (!Array.isArray(pair) || pair.length !== 2) {
    errors.push(`${label} must contain a main-hand and off-hand slot.`);
    return;
  }

  const [mainHand, offHand] = pair;
  if (allowEmpty && !mainHand && !offHand) return;
  const mainWielding = catalog.weaponHands.get(mainHand);
  const offWielding = offHand ? catalog.weaponHands.get(offHand) : null;
  if (!catalog.weapons.has(mainHand) || !['mh', 'mh+oh', '2h'].includes(mainWielding || '')) {
    errors.push(`${label} has an invalid main-hand weapon.`);
  }

  if (mainWielding === '2h' && offHand) {
    errors.push(`${mainHand} is two-handed and cannot use ${offHand}.`);
  }

  if (offHand && (!catalog.weapons.has(offHand) || !['oh', 'mh+oh'].includes(offWielding || ''))) {
    errors.push(`${offHand} cannot be equipped in the off hand.`);
  }
}

function validateSpecializations(
  build: Gw2CanonicalBuild,
  catalog: CanonicalCatalog,
  professionId: string,
  errors: string[]
): void {
  if (!Array.isArray(build.specializations)) {
    errors.push('specializations must be an array.');
    return;
  }

  const known = new Map(catalog.specializations.map((specialization) => [specialization.name, specialization]));
  const selected = build.specializations
    .map((specialization) => known.get(specialization?.name))
    .filter((specialization) => specialization != null);
  if (selected.length !== build.specializations.length) {
    errors.push(`specializations contain an unknown ${professionName(professionId)} line.`);
  }

  if (selected.filter((specialization) => specialization.elite).length > 1) {
    errors.push('only one elite specialization can be selected.');
  }

  if (new Set(selected.map((specialization) => specialization.name)).size !== selected.length) {
    errors.push('specializations cannot contain duplicates.');
  }

  if (
    build.specializations.some((specialization) => !/^[1-3]-[1-3]-[1-3]$/.test(String(specialization?.traits || '')))
  ) {
    errors.push('specialization traits must use the 1-1-1 selection format.');
  }

  if (build.specializations.length !== 3) {
    errors.push('exactly three specializations must be selected.');
  }
}

function validCanonicalMilliseconds(command: SchedulerRecord, field: string): boolean {
  if (!Object.hasOwn(command, field)) return true;
  const value = Number(command[field]);
  return Number.isFinite(value) && value >= 0;
}

/** Allows any finite number (including negative) — used for combat-start concurrentOffsetMs. */
function validCanonicalOffset(command: SchedulerRecord, field: string): boolean {
  if (!Object.hasOwn(command, field)) return true;
  return Number.isFinite(Number(command[field]));
}

/** Field is optional; when present must be an integer ≥ 1 (used for releaseAtCharges). */
function validCanonicalPositiveInteger(command: SchedulerRecord, field: string): boolean {
  if (!Object.hasOwn(command, field)) return true;
  const value = Number(command[field]);
  return Number.isInteger(value) && value >= 1;
}

function validateRotationCommand(command: unknown, catalog: CanonicalCatalog, errors: string[]): void {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    errors.push('rotation contains an invalid canonical command.');
    return;
  }

  const candidate = command as SchedulerRecord;
  // Accept every canonical command emitted by migration while keeping cast-only payloads guarded below.
  if (!['cast', 'wait', 'combat-start', 'cooldown-reset'].includes(String(candidate.type))) {
    errors.push('rotation contains an invalid canonical command.');
    return;
  }

  if (
    !(candidate.type === 'combat-start'
      ? validCanonicalOffset(candidate, 'concurrentOffsetMs')
      : validCanonicalMilliseconds(candidate, 'concurrentOffsetMs')) ||
    !validCanonicalMilliseconds(candidate, 'interruptAfterMs') ||
    !validCanonicalMilliseconds(candidate, 'initialStateDurationMs')
  ) {
    errors.push('rotation timing fields must be finite; cast timing must be non-negative.');
  }

  if (!validCanonicalPositiveInteger(candidate, 'releaseAtCharges')) {
    errors.push('releaseAtCharges must be a positive whole number.');
  }

  if (
    Object.hasOwn(candidate, 'doubleEdgeOutcome') &&
    !['success', 'backfire'].includes(String(candidate.doubleEdgeOutcome))
  ) {
    errors.push('doubleEdgeOutcome must be success or backfire.');
  }

  if (candidate.type !== 'cast' && Object.hasOwn(candidate, 'interruptAfterMs')) {
    errors.push('only cast commands may contain interruptAfterMs.');
  }

  if (candidate.type !== 'cast' && Object.hasOwn(candidate, 'initialStateDurationMs')) {
    errors.push('only cast commands may contain initialStateDurationMs.');
  }

  if (candidate.type !== 'cast' && Object.hasOwn(candidate, 'releaseAtCharges')) {
    errors.push('only cast commands may contain releaseAtCharges.');
  }

  if (candidate.type !== 'cast' && Object.hasOwn(candidate, 'doubleEdgeOutcome')) {
    errors.push('only cast commands may contain doubleEdgeOutcome.');
  }

  if (candidate.type === 'wait') {
    if (!Object.hasOwn(candidate, 'durationMs') || !validCanonicalMilliseconds(candidate, 'durationMs')) {
      errors.push('wait commands require a non-negative durationMs.');
    }

    if (Object.hasOwn(candidate, 'concurrentOffsetMs')) {
      errors.push('wait commands cannot contain concurrentOffsetMs.');
    }
  }

  if (candidate.type === 'cast' && (!isSkillId(candidate.skillId) || !catalog.skillsById.has(candidate.skillId))) {
    errors.push(`rotation contains unknown skill ${candidate.skillId}.`);
  }
}

function isSkillId(value: unknown): value is SkillId {
  return typeof value === 'string' || typeof value === 'number';
}

function validateCommonBuild(
  build: unknown,
  { professionId, schemaVersion, catalog, slotLoadout = null }: Gw2BuildValidationOptions
): Gw2BuildValidationResult {
  const errors: string[] = [];
  if (!build || typeof build !== 'object' || Array.isArray(build)) {
    return { valid: false, errors: ['Build must be an object.'] };
  }

  const candidate = build as Gw2CanonicalBuild;
  // Keep malformed imported specialization data recoverable while preserving the shape error below.
  const specializations = Array.isArray(candidate.specializations) ? candidate.specializations : [];
  errors.push(...validateCommonAssumptions(candidate.assumptions));
  if (candidate.profession !== professionId) {
    errors.push(`profession must be ${professionId}.`);
  }

  if (candidate.schemaVersion !== schemaVersion) {
    errors.push(`schemaVersion must be ${schemaVersion}.`);
  }

  validateWeaponPair(candidate.weapons, 'weapons', catalog, errors);
  // Alternate weapons are optional; allowEmpty=true lets both slots be absent.
  validateWeaponPair(candidate.alternateWeapons, 'alternateWeapons', catalog, errors, true);
  if (![1, 2].includes(candidate.startingWeaponSet)) {
    errors.push('startingWeaponSet must be 1 or 2.');
  } else if (candidate.startingWeaponSet === 2 && !candidate.alternateWeapons?.[0]) {
    errors.push('startingWeaponSet cannot be 2 without a second weapon set.');
  }

  if (!Array.isArray(candidate.rotation)) {
    errors.push('rotation must be an array.');
  } else {
    for (const command of candidate.rotation) {
      validateRotationCommand(command, catalog, errors);
    }
  }

  validateSpecializations(candidate, catalog, professionId, errors);
  if (slotLoadout) {
    // Slot-loadout professions manage skill slots through their own palette
    // system; delegate validation to that system.
    const eliteNames = new Set(
      catalog.specializations
        .filter((specialization) => specialization.elite)
        .map((specialization) => specialization.name)
    );
    const specialization = specializations.find((selection) => eliteNames.has(selection?.name))?.name || 'Core';
    errors.push(
      ...slotLoadout
        .validateBuild(candidate, {
          build: candidate,
          specialization,
          catalog
        })
        .map(String)
    );
  } else if (!isPlainObject(candidate.selectedSkills)) {
    errors.push('selectedSkills must be an object.');
  } else {
    const selectedSpecializations = new Set(specializations.map((specialization) => specialization?.name));
    // Track already-used utility IDs so duplicates across Utility1-3 are flagged.
    const selectedUtilityIds = new Set();
    for (const [slot, type] of Object.entries(SLOT_TYPES)) {
      const skill = catalog.skillsByName.get(candidate.selectedSkills[slot]);
      if (
        !selectableSlotSkill(skill, type, selectedSpecializations) ||
        (type === 'Utility' && selectedUtilityIds.has(skill?.id))
      ) {
        errors.push(`${slot} must contain an available ${type} skill.`);
      }

      if (type === 'Utility' && skill) selectedUtilityIds.add(skill.id);
    }
  }

  if (!isPlainObject(candidate.gear)) {
    errors.push('gear must be an object.');
  } else {
    for (const slot of GEAR_SLOTS) {
      if (!GEAR_STATS_BY_NAME[candidate.gear[slot]]) {
        errors.push(`${slot} must contain a known gear prefix.`);
      }
    }
  }

  // alternateWeaponPrefixes is optional (null/undefined = inherit main-hand gear);
  // only validate it when the field is actually present.
  if (
    candidate.alternateWeaponPrefixes != null &&
    (!Array.isArray(candidate.alternateWeaponPrefixes) ||
      candidate.alternateWeaponPrefixes.length !== 2 ||
      candidate.alternateWeaponPrefixes.some((prefix) => !GEAR_STATS_BY_NAME[prefix]))
  ) {
    errors.push('alternateWeaponPrefixes must contain two known gear prefixes.');
  }

  if (!listedName(RELIC_NAMES, candidate.relic)) {
    errors.push('relic must be a known relic.');
  }

  if (!listedName(RUNE_NAMES, candidate.rune)) {
    errors.push('rune must be a known rune.');
  }

  if (!listedName(FOOD_NAMES, candidate.food)) {
    errors.push('food must be a known food.');
  }

  if (!listedName(UTILITY_NAMES, candidate.utility)) {
    errors.push('utility must be a known utility consumable.');
  }

  if (typeof candidate.jadeBotCore !== 'boolean') {
    errors.push('jadeBotCore must be a boolean.');
  }

  if (
    !Array.isArray(candidate.weaponSigils) ||
    candidate.weaponSigils.length !== 2 ||
    candidate.weaponSigils.some(
      (set) =>
        !Array.isArray(set) ||
        set.length !== 2 ||
        set.some((sigil) => !listedName(SIGIL_NAMES, sigil)) ||
        set[0] === set[1]
    )
  ) {
    errors.push('weaponSigils must contain two valid, unique sigils per set.');
  }

  if (!Array.isArray(candidate.infusions)) {
    errors.push('infusions must be an array.');
  } else {
    let total = 0;
    for (const infusion of candidate.infusions) {
      const count = Number(infusion?.count);
      if (!listedName(INFUSION_STATS, infusion?.stat) || !Number.isInteger(count) || count < 0 || count > 18) {
        errors.push('infusions contain an invalid stat or count.');
        break;
      }

      total += count;
    }

    if (total > 18) errors.push('infusion count cannot exceed 18.');
  }

  if (!Number.isFinite(Number(candidate.targetHealth)) || Number(candidate.targetHealth) < 0) {
    errors.push('targetHealth must be a non-negative number.');
  }

  if (
    !Number.isFinite(Number(candidate.targetStartingHealthPercent)) ||
    Number(candidate.targetStartingHealthPercent) < 0 ||
    Number(candidate.targetStartingHealthPercent) > 100
  ) {
    errors.push('targetStartingHealthPercent must be between 0 and 100.');
  }

  if (!Number.isFinite(Number(candidate.targetArmor)) || Number(candidate.targetArmor) < 1) {
    errors.push('targetArmor must be at least 1.');
  }

  return { valid: errors.length === 0, errors };
}
