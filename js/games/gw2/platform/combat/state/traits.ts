import type { CatalogEntity, SkillId } from '#gw2/platform/engine/types.js';

function includesTrait(values: readonly (string | number)[] | undefined, traitId: SkillId, key: string): boolean {
  return Boolean(values?.some((value) => value === traitId || String(value) === key));
}

export interface Gw2TraitLookupConfig {
  readonly selectedTraitIds?: readonly (string | number)[] | null;
}

export interface Gw2TraitLookupContext extends Gw2TraitLookupConfig {
  readonly traits?: ReadonlySet<string | number> | null;
  readonly config?: Gw2TraitLookupConfig | null;
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

  // Sources without a normalized trait set resolve internal name-based rules
  // through the catalog before checking canonical IDs.
  const selectedTraitId = configuredTraitId(context, traitId);
  const selectedTraitIds = Array.isArray(context.selectedTraitIds)
    ? context.selectedTraitIds
    : Array.isArray(context.config?.selectedTraitIds)
      ? context.config.selectedTraitIds
      : undefined;
  return includesTrait(selectedTraitIds, selectedTraitId, String(selectedTraitId));
}
