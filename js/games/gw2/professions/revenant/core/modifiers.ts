import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import {
  pactOfPainDuration,
  yearningEmpowermentDuration
} from '#gw2/professions/revenant/core/traits/corruption/behavior.js';
import { modifyCoreAttributes } from '#gw2/professions/revenant/core/traits/devastation/attributes.js';
import { modifyCoreCriticalChance } from '#gw2/professions/revenant/core/traits/invocation/queries.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';

interface RevenantModifierContext extends Gw2ModifierContext {
  readonly config?: RevenantConfig;
}

// Apply Revenant's condition- and skill-specific base duration modifiers before
// shared Expertise scaling.
function modifyCoreConditionDuration(context: RevenantModifierContext, duration: number): number {
  return yearningEmpowermentDuration(context, pactOfPainDuration(context, duration));
}

export const revenantCoreModifiers = Object.freeze({
  modifyAttributes: modifyCoreAttributes,
  modifyCriticalChance: modifyCoreCriticalChance,
  modifyConditionDuration: modifyCoreConditionDuration
});
