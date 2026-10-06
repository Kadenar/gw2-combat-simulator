import type { SkillId } from '#gw2/platform/skills/types.js';

interface Gw2TraitLookupConfig {
  readonly selectedTraitIds?: readonly (string | number)[] | null;
}

export interface Gw2TraitLookupContext extends Gw2TraitLookupConfig {
  readonly traits?: ReadonlySet<string | number> | null;
  readonly config?: Gw2TraitLookupConfig | null;
}

/** Normalizes selected trait IDs once so runtime membership checks use stable numeric IDs where possible. */
export function normalizeSelectedTraitIds(values?: readonly SkillId[] | null): Set<SkillId> {
  return new Set(
    (Array.isArray(values) ? values : []).map((value) => (Number.isFinite(Number(value)) ? Number(value) : value))
  );
}

function lookupContext(value: unknown): Gw2TraitLookupContext | null {
  return typeof value === 'object' && value !== null ? value : null;
}

function traitSet(value: unknown): ReadonlySet<string | number> | null {
  if (typeof value !== 'object' || value === null || typeof (value as { readonly has?: unknown }).has !== 'function') {
    return null;
  }

  return value as ReadonlySet<string | number>;
}

function setIncludesTrait(traits: ReadonlySet<string | number>, traitId: SkillId): boolean {
  const key = String(traitId);
  const numeric = Number(key);
  return traits.has(traitId) || traits.has(key) || (Number.isFinite(numeric) && traits.has(numeric));
}

/**
 * Safely adapts scheduler, resolver, modifier, application, raw-config, and
 * normalized-set sources so profession logic shares one trait lookup contract.
 */
export function hasTrait(value: unknown, traitId: SkillId): boolean {
  const directTraits = traitSet(value);
  if (directTraits) return setIncludesTrait(directTraits, traitId);

  const context = lookupContext(value);
  if (!context) return false;

  if (context.traits != null) {
    const traits = traitSet(context.traits);
    if (!traits) return false;

    return setIncludesTrait(traits, traitId);
  }

  // Raw configurations compare stable IDs directly; display names never resolve through the catalog.
  const selectedTraitIds = Array.isArray(context.selectedTraitIds)
    ? context.selectedTraitIds
    : Array.isArray(context.config?.selectedTraitIds)
      ? context.config.selectedTraitIds
      : undefined;
  return selectedTraitIds?.some((value) => String(value) === String(traitId)) ?? false;
}
