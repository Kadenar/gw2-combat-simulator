import type { SkillId } from '../../../engine/types.js';
import type { Gw2TraitContext } from '../modifiers/types.js';

function includesTrait(values: readonly (string | number)[] | undefined, traitId: SkillId, key: string): boolean {
  return Boolean(values?.some((value) => value === traitId || String(value) === key));
}

function configuredTraitId(context: Gw2TraitContext, traitId: SkillId): SkillId {
  if (typeof traitId !== 'string' || Number.isFinite(Number(traitId))) return traitId;

  return context.catalog?.traits?.find((trait) => trait.name === traitId)?.id ?? traitId;
}

/**
 * Looks up a trait by stable ID across resolver and application configuration
 * context shapes.
 */
export function hasTrait(context: Gw2TraitContext, traitId: SkillId): boolean {
  const key = String(traitId);
  if (context.traits) {
    const numeric = Number(key);
    return (
      context.traits.has(traitId) ||
      context.traits.has(key) ||
      (Number.isFinite(numeric) && context.traits.has(numeric))
    );
  }

  // Raw scheduler contexts do not carry the normalized trait set, so resolve
  // internal name-based rules through the catalog before checking canonical IDs.
  const selectedTraitId = configuredTraitId(context, traitId);
  return includesTrait(context.config?.selectedTraitIds, selectedTraitId, String(selectedTraitId));
}
