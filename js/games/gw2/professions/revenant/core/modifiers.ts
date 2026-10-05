import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { countActiveBoons, buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import {
  modifyCoreAttributes,
  modifyCoreCriticalChance,
  pactOfPainDuration,
  yearningEmpowermentDuration
} from '#gw2/professions/revenant/core/traits/behavior.js';
import type { RevenantConfig } from '#gw2/professions/revenant/types.js';

interface RevenantModifierContext extends Gw2ModifierContext {
  readonly config?: RevenantConfig;
}

export function revenantTimedBuff(context: RevenantModifierContext, kind: string): boolean {
  // Timed modifiers read accepted non-boon windows.
  return buffActive(context, kind);
}

// Count distinct self-affecting boons active at the query time for Revenant
// modifiers that scale with boon variety.
export function revenantActiveBoonCount(context: RevenantModifierContext): number {
  return countActiveBoons(context);
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
