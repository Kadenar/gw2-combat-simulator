import { GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import {
  modifyCoreAttributes,
  modifyCoreCriticalChance,
  pactOfPainDuration,
  yearningEmpowermentDuration
} from '#gw2/professions/revenant/core/traits/behavior.js';
import type { RevenantConfig, RevenantState } from '#gw2/professions/revenant/types.js';

interface RevenantModifierContext extends Gw2ModifierContext {
  readonly config?: RevenantConfig;
}

function revenantRuntimeState(context: RevenantModifierContext): object | undefined {
  return context.runtime?.profession ?? context.state?.profession;
}

export function revenantRuntimeCoreState(context: RevenantModifierContext): Partial<RevenantCoreState> {
  return readProfessionCoreState<RevenantCoreState>(revenantRuntimeState(context));
}

export function revenantRuntimeSpecializationState(
  context: RevenantModifierContext,
  expectedKind: string
): Partial<RevenantState> {
  return readProfessionSpecializationState<RevenantState>(revenantRuntimeState(context), expectedKind) || {};
}

export function revenantTimedBuff(context: RevenantModifierContext, kind: string): boolean {
  if (context.config?.boons?.[kind]) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application) => application.at <= context.time && application.expiresAt > context.time
  );
}

// Count distinct self-affecting boons active at the query time for Revenant
// modifiers that scale with boon variety.
export function revenantActiveBoonCount(context: RevenantModifierContext): number {
  return GW2_STANDARD_BOONS.filter((boon) => boonActive(context, boon)).length;
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
