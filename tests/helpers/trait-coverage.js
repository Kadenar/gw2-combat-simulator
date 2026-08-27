/** @type {{
 *   readonly IMPLEMENTED: "implemented",
 *   readonly OUT_OF_MODEL: "out-of-model",
 *   readonly PENDING: "pending",
 * }}
 */
export const TRAIT_COVERAGE_STATUSES = Object.freeze({
  IMPLEMENTED: 'implemented',
  OUT_OF_MODEL: 'out-of-model',
  PENDING: 'pending'
});

const VALID_STATUSES = new Set(Object.values(TRAIT_COVERAGE_STATUSES));

function normalizedText(value) {
  return String(value || '').trim();
}

// Strips non-alphanumerics so "Feline Grace." and "Feline Grace" compare equal —
// prevents a description that is just the trait name with punctuation.
function comparableText(value) {
  return normalizedText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// Rejects boilerplate placeholders and overly short strings that don't actually
// explain why a trait is pending or out of model.
function concreteReason(value) {
  const reason = normalizedText(value);

  if (reason.length < 12) return false;

  return !['out of model', 'not supported', 'unsupported', 'not applicable'].includes(reason.toLowerCase());
}

/**
 * @param {unknown} effect
 * @param {{ status?: unknown, reason?: unknown }} entry
 * @param {{ id: string | number, name: string }} trait
 * @param {number} index
 */
function normalizeEffect(effect, entry, trait, index) {
  // A bare string is shorthand for an effect that inherits the entry-level status —
  // convenient for simple traits where every effect has the same status.
  const value =
    typeof effect === 'string'
      ? { description: effect, status: entry.status }
      : effect && typeof effect === 'object' && !Array.isArray(effect)
        ? { ...effect }
        : {};
  const description = normalizedText(value.description);

  if (!description) {
    throw new TypeError(`Trait ${trait.id} coverage effect ${index + 1} needs a description.`);
  }

  if (comparableText(description) === comparableText(trait.name)) {
    throw new TypeError(`Trait ${trait.id} coverage must document effects, not only its name.`);
  }

  const rawStatus = value.status || entry.status;

  if (typeof rawStatus !== 'string' || !VALID_STATUSES.has(rawStatus)) {
    throw new TypeError(`Trait ${trait.id} coverage effect ${index + 1} has invalid status.`);
  }

  const status = rawStatus;
  const reason = normalizedText(value.reason || entry.reason);

  if (
    (status === TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL || status === TRAIT_COVERAGE_STATUSES.PENDING) &&
    !concreteReason(reason)
  ) {
    throw new TypeError(`Trait ${trait.id} ${status} effect ${index + 1} needs a concrete reason.`);
  }

  return Object.freeze({
    description,
    status,
    reason: reason || null
  });
}

/**
 * Validates the modeled implementation scope for every trait in a profession
 * catalog without treating source-code test titles as behavioral proof.
 *
 * Effects may be compact strings, inheriting the entry status, or structured
 * objects with their own status/reason for mixed traits.
 *
 * @param {{ traits?: readonly object[] } | null | undefined} catalog
 * @param {unknown} manifest
 * @param {{ professionId?: string }} [options]
 */
export function validateTraitCoverageManifest(catalog, manifest, { professionId = 'profession' } = {}) {
  const traits = Array.isArray(catalog?.traits) ? catalog.traits : [];

  if (!Array.isArray(manifest)) {
    throw new TypeError(`${professionId} trait coverage must be an array.`);
  }

  const traitsById = new Map(traits.map((trait) => [Number(trait.id), trait]));
  const coverageById = new Map();

  for (const rawEntry of manifest) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      throw new TypeError(`${professionId} trait coverage entries must be objects.`);
    }

    const entry = rawEntry;

    if (Object.hasOwn(entry, 'tests')) {
      throw new TypeError(`${professionId} trait coverage cannot use test-title evidence.`);
    }

    const traitId = Number(entry.traitId);
    const trait = traitsById.get(traitId);

    if (!trait) {
      throw new TypeError(`${professionId} trait coverage references unknown trait ${entry.traitId}.`);
    }

    if (coverageById.has(traitId)) {
      throw new TypeError(`${professionId} trait coverage duplicates trait ${traitId}.`);
    }

    if (typeof entry.status !== 'string' || !VALID_STATUSES.has(entry.status)) {
      throw new TypeError(`${professionId} trait ${traitId} has invalid coverage status.`);
    }

    if (!Array.isArray(entry.effects) || entry.effects.length === 0) {
      throw new TypeError(`${professionId} trait ${traitId} must document every reviewed effect.`);
    }

    const effects = entry.effects.map((effect, index) => normalizeEffect(effect, entry, trait, index));
    const status = entry.status;
    const reason = normalizedText(entry.reason);

    if (
      (status === TRAIT_COVERAGE_STATUSES.OUT_OF_MODEL || status === TRAIT_COVERAGE_STATUSES.PENDING) &&
      !concreteReason(reason)
    ) {
      throw new TypeError(`${professionId} ${status} trait ${traitId} needs a concrete reason.`);
    }

    coverageById.set(
      traitId,
      Object.freeze({
        traitId,
        status,
        effects: Object.freeze(effects),
        reason: reason || null
      })
    );
  }

  // After processing all entries, verify every catalog trait has coverage —
  // traits added to the catalog without a coverage entry are a silent omission.
  const missing = traits
    .filter((trait) => !coverageById.has(Number(trait.id)))
    .map((trait) => `${trait.id} (${trait.name})`);

  if (missing.length) {
    throw new TypeError(`${professionId} trait coverage is missing: ${missing.join(', ')}.`);
  }

  return Object.freeze([...coverageById.values()]);
}
