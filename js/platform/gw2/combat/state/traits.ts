import type { CatalogEntity, SkillId } from '../../../engine/types.js';

function includesTrait(values: readonly (string | number)[] | undefined, traitId: SkillId, key: string): boolean {
  return Boolean(values?.some((value) => value === traitId || String(value) === key));
}

interface Gw2TraitLookupContext {
  readonly traits?: ReadonlySet<string | number> | null;
  readonly config?: { readonly selectedTraitIds?: readonly (string | number)[] | null } | null;
  readonly catalog?: { readonly traits?: readonly CatalogEntity[] | null } | null;
}

function lookupContext(value: unknown): Gw2TraitLookupContext | null {
  return typeof value === 'object' && value !== null ? (value as Gw2TraitLookupContext) : null;
}

function traitSet(value: unknown): ReadonlySet<string | number> | null {
  if (typeof value !== 'object' || value === null || typeof (value as { readonly has?: unknown }).has !== 'function') {
    return null;
  }

  return value as ReadonlySet<string | number>;
}

function configuredTraitId(context: Gw2TraitLookupContext, traitId: SkillId): SkillId {
  if (typeof traitId !== 'string' || Number.isFinite(Number(traitId))) return traitId;

  const traits = Array.isArray(context.catalog?.traits) ? context.catalog.traits : [];
  return traits.find((trait) => trait.name === traitId)?.id ?? traitId;
}

/**
 * Safely adapts scheduler, resolver, modifier, and application contexts to one
 * trait lookup contract so profession logic can query IDs or catalog names.
 */
export function hasTrait(value: unknown, traitId: SkillId): boolean {
  const context = lookupContext(value);
  if (!context) return false;

  const key = String(traitId);
  if (context.traits != null) {
    const traits = traitSet(context.traits);
    if (!traits) return false;

    const numeric = Number(key);
    return traits.has(traitId) || traits.has(key) || (Number.isFinite(numeric) && traits.has(numeric));
  }

  // Raw scheduler contexts do not carry the normalized trait set, so resolve
  // internal name-based rules through the catalog before checking canonical IDs.
  const selectedTraitId = configuredTraitId(context, traitId);
  const selectedTraitIds = Array.isArray(context.config?.selectedTraitIds)
    ? context.config.selectedTraitIds
    : undefined;
  return includesTrait(selectedTraitIds, selectedTraitId, String(selectedTraitId));
}
