import type {
  CatalogEntity,
  SchedulerRecord,
} from "../engine/types.js";
import type {
  Gw2TraitCoverageCatalog,
  Gw2TraitCoverageEffect,
  Gw2TraitCoverageEffectInput,
  Gw2TraitCoverageEntry,
  Gw2TraitCoverageEntryInput,
  Gw2TraitCoverageStatus,
  Gw2TraitCoverageTestEvidence,
} from "./types.js";

/** @type {{
 *   readonly IMPLEMENTED: "implemented",
 *   readonly OUT_OF_MODEL: "out-of-model",
 *   readonly PENDING: "pending",
 * }}
 */
export const TRAIT_COVERAGE_STATUSES = Object.freeze({
  IMPLEMENTED: "implemented",
  OUT_OF_MODEL: "out-of-model",
  PENDING: "pending",
} as const);

const VALID_STATUSES: ReadonlySet<Gw2TraitCoverageStatus> =
  new Set(Object.values(TRAIT_COVERAGE_STATUSES));

function normalizedText(value: unknown): string {
  return String(value || "").trim();
}

// Strips non-alphanumerics so "Feline Grace." and "Feline Grace" compare equal —
// prevents a description that is just the trait name with punctuation.
function comparableText(value: unknown): string {
  return normalizedText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Rejects boilerplate placeholders and overly short strings that don't actually
// explain why a trait is pending or out of model.
function concreteReason(value: unknown): boolean {
  const reason = normalizedText(value);
  if (reason.length < 12) return false;
  return ![
    "out of model",
    "not supported",
    "unsupported",
    "not applicable",
  ].includes(reason.toLowerCase());
}

/**
 * @param {unknown} effect
 * @param {Gw2TraitCoverageEntryInput} entry
 * @param {CatalogEntity} trait
 * @param {number} index
 * @returns {Gw2TraitCoverageEffect}
 */
function normalizeEffect(
  effect: unknown,
  entry: Gw2TraitCoverageEntryInput,
  trait: CatalogEntity,
  index: number,
): Gw2TraitCoverageEffect {
  // A bare string is shorthand for an effect that inherits the entry-level status —
  // convenient for simple traits where every effect has the same status.
  const value = (
    typeof effect === "string"
      ? { description: effect, status: entry.status }
      : effect && typeof effect === "object" && !Array.isArray(effect)
        ? { ...effect }
        : {}
  ) as Gw2TraitCoverageEffectInput;
  const description = normalizedText(value.description);
  if (!description) {
    throw new TypeError(
      `Trait ${trait.id} coverage effect ${index + 1} needs a description.`,
    );
  }
  if (comparableText(description) === comparableText(trait.name)) {
    throw new TypeError(
      `Trait ${trait.id} coverage must document effects, not only its name.`,
    );
  }
  const rawStatus = value.status || entry.status;
  if (
    typeof rawStatus !== "string" ||
    !VALID_STATUSES.has(rawStatus as Gw2TraitCoverageStatus)
  ) {
    throw new TypeError(
      `Trait ${trait.id} coverage effect ${index + 1} has invalid status.`,
    );
  }
  const status = rawStatus as Gw2TraitCoverageStatus;
  const reason = normalizedText(value.reason || entry.reason);
  if (
    (
      status === TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL
      || status === TRAIT_COVERAGE_STATUSES.PENDING
    ) &&
    !concreteReason(reason)
  ) {
    throw new TypeError(
      `Trait ${trait.id} ${status} effect ${index + 1} needs a concrete reason.`,
    );
  }
  return Object.freeze({
    description,
    status,
    reason: reason || null,
  });
}

/**
 * @param {unknown} value
 * @param {CatalogEntity} trait
 * @param {number} index
 * @returns {Gw2TraitCoverageTestEvidence}
 */
function normalizeTestEvidence(
  value: unknown,
  trait: CatalogEntity,
  index: number,
): Gw2TraitCoverageTestEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(
      `Trait ${trait.id} test evidence ${index + 1} must be an object.`,
    );
  }
  const evidence = value as SchedulerRecord;
  const file = normalizedText(evidence.file);
  const name = normalizedText(evidence.name);
  if (!/^tests\/.+\.test\.js$/.test(file)) {
    throw new TypeError(
      `Trait ${trait.id} test evidence ${index + 1} needs a tests/**/*.test.js file.`,
    );
  }
  if (!name) {
    throw new TypeError(
      `Trait ${trait.id} test evidence ${index + 1} needs a test name.`,
    );
  }
  return Object.freeze({ file, name });
}

/**
 * Validates behavioral coverage for every trait in a profession catalog.
 *
 * Effects may be compact strings, inheriting the entry status, or structured
 * objects with their own status/reason for mixed traits.
 *
 * @param {Gw2TraitCoverageCatalog | null | undefined} catalog
 * @param {unknown} manifest
 * @param {{ professionId?: string }} [options]
 * @returns {readonly Gw2TraitCoverageEntry[]}
 */
export function validateTraitCoverageManifest(
  catalog: Gw2TraitCoverageCatalog | null | undefined,
  manifest: unknown,
  { professionId = "profession" }: {
    readonly professionId?: string;
  } = {},
): readonly Gw2TraitCoverageEntry[] {
  const traits = Array.isArray(catalog?.traits)
    ? catalog.traits
    : [];
  if (!Array.isArray(manifest)) {
    throw new TypeError(`${professionId} trait coverage must be an array.`);
  }
  const traitsById = new Map<number, CatalogEntity>(
    traits.map((trait) => [Number(trait.id), trait]),
  );
  const coverageById = new Map<number, Gw2TraitCoverageEntry>();

  for (const rawEntry of manifest) {
    if (
      !rawEntry ||
      typeof rawEntry !== "object" ||
      Array.isArray(rawEntry)
    ) {
      throw new TypeError(
        `${professionId} trait coverage entries must be objects.`,
      );
    }
    const entry = rawEntry as Gw2TraitCoverageEntryInput;
    const traitId = Number(entry.traitId);
    const trait = traitsById.get(traitId);
    if (!trait) {
      throw new TypeError(
        `${professionId} trait coverage references unknown trait ${entry.traitId}.`,
      );
    }
    if (coverageById.has(traitId)) {
      throw new TypeError(
        `${professionId} trait coverage duplicates trait ${traitId}.`,
      );
    }
    if (
      typeof entry.status !== "string" ||
      !VALID_STATUSES.has(
        entry.status as Gw2TraitCoverageStatus,
      )
    ) {
      throw new TypeError(
        `${professionId} trait ${traitId} has invalid coverage status.`,
      );
    }
    if (!Array.isArray(entry.effects) || entry.effects.length === 0) {
      throw new TypeError(
        `${professionId} trait ${traitId} must document every reviewed effect.`,
      );
    }
    const tests = Array.isArray(entry.tests)
      ? (entry.tests as unknown[]).map((value, index) =>
          normalizeTestEvidence(value, trait, index),
        )
      : [];
    const effects = (entry.effects as unknown[]).map(
      (effect, index) =>
        normalizeEffect(effect, entry, trait, index),
    );
    const status = entry.status as Gw2TraitCoverageStatus;
    // Implemented traits (or entries with at least one implemented effect) must
    // link a behavioral test — can't claim "implemented" without verifiable evidence.
    if (
      (status === TRAIT_COVERAGE_STATUSES.IMPLEMENTED ||
        effects.some(
          (effect) => effect.status === TRAIT_COVERAGE_STATUSES.IMPLEMENTED,
        )) &&
      tests.length === 0
    ) {
      throw new TypeError(
        `${professionId} implemented trait ${traitId} needs a behavioral test reference.`,
      );
    }
    const reason = normalizedText(entry.reason);
    if (
      (
        status === TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL
        || status === TRAIT_COVERAGE_STATUSES.PENDING
      ) &&
      !concreteReason(reason)
    ) {
      throw new TypeError(
        `${professionId} ${status} trait ${traitId} needs a concrete reason.`,
      );
    }
    coverageById.set(
      traitId,
      Object.freeze({
        traitId,
        status,
        effects: Object.freeze(effects),
        tests: Object.freeze(tests),
        reason: reason || null,
      }),
    );
  }

  // After processing all entries, verify every catalog trait has coverage —
  // traits added to the catalog without a coverage entry are a silent omission.
  const missing = traits
    .filter((trait) => !coverageById.has(Number(trait.id)))
    .map((trait) => `${trait.id} (${trait.name})`);
  if (missing.length) {
    throw new TypeError(
      `${professionId} trait coverage is missing: ${missing.join(", ")}.`,
    );
  }
  return Object.freeze([...coverageById.values()]);
}
