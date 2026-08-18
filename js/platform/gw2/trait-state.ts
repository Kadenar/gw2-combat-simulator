import type { SkillId } from '../engine/types.js';
import type { Gw2TraitContext } from './types.js';

function includesTrait(values: readonly (string | number)[] | undefined, traitId: SkillId, key: string): boolean {
  return Boolean(values?.some((value) => value === traitId || String(value) === key));
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
  return (
    includesTrait(context.config?.traitIds, traitId, key) ||
    includesTrait(context.config?.selectedTraitIds, traitId, key) ||
    includesTrait(context.config?.selectedTraits, traitId, key)
  );
}
