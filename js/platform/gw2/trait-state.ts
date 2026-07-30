import type { SkillId } from "../engine/types.js";
import type { Gw2TraitContext } from "./types.js";

/**
 * Looks up a trait by stable ID across resolver and application configuration
 * context shapes.
 */
export function hasTrait(
  context: Gw2TraitContext,
  traitId: SkillId,
): boolean {
  if (context.traits?.has(traitId) || context.traits?.has(String(traitId)))
    return true;
  return [
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ].some((value) => value === traitId || String(value) === String(traitId));
}
