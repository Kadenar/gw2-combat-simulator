export const TRAIT_COVERAGE_STATUSES = Object.freeze({
  IMPLEMENTED: "implemented",
  OUT_OF_MODEL: "out-of-model",
});

const VALID_STATUSES = new Set(Object.values(TRAIT_COVERAGE_STATUSES));

function normalizedText(value) {
  return String(value || "").trim();
}

function comparableText(value) {
  return normalizedText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function concreteReason(value) {
  const reason = normalizedText(value);
  if (reason.length < 12) return false;
  return ![
    "out of model",
    "not supported",
    "unsupported",
    "not applicable",
  ].includes(reason.toLowerCase());
}

function normalizeEffect(effect, entry, trait, index) {
  const value = typeof effect === "string"
    ? { description: effect, status: entry.status }
    : { ...effect };
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
  const status = value.status || entry.status;
  if (!VALID_STATUSES.has(status)) {
    throw new TypeError(
      `Trait ${trait.id} coverage effect ${index + 1} has invalid status.`,
    );
  }
  const reason = normalizedText(value.reason || entry.reason);
  if (
    status === TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL
    && !concreteReason(reason)
  ) {
    throw new TypeError(
      `Trait ${trait.id} out-of-model effect ${index + 1} needs a concrete reason.`,
    );
  }
  return Object.freeze({
    description,
    status,
    reason: reason || null,
  });
}

/**
 * Validates behavioral coverage for every trait in a profession catalog.
 *
 * Effects may be compact strings, inheriting the entry status, or structured
 * objects with their own status/reason for mixed traits.
 */
export function validateTraitCoverageManifest(
  catalog,
  manifest,
  { professionId = "profession" } = {},
) {
  const traits = Array.isArray(catalog?.traits) ? catalog.traits : [];
  if (!Array.isArray(manifest)) {
    throw new TypeError(`${professionId} trait coverage must be an array.`);
  }
  const traitsById = new Map(
    traits.map(trait => [Number(trait.id), trait]),
  );
  const coverageById = new Map();

  for (const rawEntry of manifest) {
    if (!rawEntry || typeof rawEntry !== "object") {
      throw new TypeError(`${professionId} trait coverage entries must be objects.`);
    }
    const traitId = Number(rawEntry.traitId);
    const trait = traitsById.get(traitId);
    if (!trait) {
      throw new TypeError(
        `${professionId} trait coverage references unknown trait ${rawEntry.traitId}.`,
      );
    }
    if (coverageById.has(traitId)) {
      throw new TypeError(
        `${professionId} trait coverage duplicates trait ${traitId}.`,
      );
    }
    if (!VALID_STATUSES.has(rawEntry.status)) {
      throw new TypeError(
        `${professionId} trait ${traitId} has invalid coverage status.`,
      );
    }
    if (!Array.isArray(rawEntry.effects) || rawEntry.effects.length === 0) {
      throw new TypeError(
        `${professionId} trait ${traitId} must document every reviewed effect.`,
      );
    }
    const tests = Array.isArray(rawEntry.tests)
      ? rawEntry.tests.map(normalizedText).filter(Boolean)
      : [];
    const effects = rawEntry.effects.map((effect, index) =>
      normalizeEffect(effect, rawEntry, trait, index));
    if (
      (
        rawEntry.status === TRAIT_COVERAGE_STATUSES.IMPLEMENTED
        || effects.some(effect =>
          effect.status === TRAIT_COVERAGE_STATUSES.IMPLEMENTED)
      )
      && tests.length === 0
    ) {
      throw new TypeError(
        `${professionId} implemented trait ${traitId} needs a behavioral test reference.`,
      );
    }
    const reason = normalizedText(rawEntry.reason);
    if (
      rawEntry.status === TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL
      && !concreteReason(reason)
    ) {
      throw new TypeError(
        `${professionId} out-of-model trait ${traitId} needs a concrete reason.`,
      );
    }
    coverageById.set(traitId, Object.freeze({
      traitId,
      status: rawEntry.status,
      effects: Object.freeze(effects),
      tests: Object.freeze(tests),
      reason: reason || null,
    }));
  }

  const missing = traits
    .filter(trait => !coverageById.has(Number(trait.id)))
    .map(trait => `${trait.id} (${trait.name})`);
  if (missing.length) {
    throw new TypeError(
      `${professionId} trait coverage is missing: ${missing.join(", ")}.`,
    );
  }
  return Object.freeze([...coverageById.values()]);
}
