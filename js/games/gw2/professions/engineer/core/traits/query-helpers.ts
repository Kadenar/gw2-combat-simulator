import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import {
  activeBoonStacks,
  playerHealthFraction,
  targetConditionCount,
  targetHealthFraction
} from '#gw2/platform/combat/query/runtime-query.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { EngineerSimulationEvent, EngineerState } from '#gw2/professions/engineer/types.js';

/** Narrows the active modifier event to Engineer's extended simulation event shape. */
export function engineerEvent(context: Gw2ModifierContext): EngineerSimulationEvent | undefined {
  return context.event || undefined;
}

/** Reads Core state from the live simulation or the isolated attribute preview. */
export function engineerRuntimeState(context: Gw2ModifierContext): Partial<EngineerState> {
  return readProfessionCoreState<EngineerState>(
    context.runtime?.profession ?? (context.state as { readonly profession?: unknown } | undefined)?.profession
  );
}

/** Reads the active specialization in simulation or attribute preview. */
export function engineerSpecializationState(context: Gw2ModifierContext, expectedKind: string): Partial<EngineerState> {
  const state =
    context.runtime?.profession ?? (context.state as { readonly profession?: unknown } | undefined)?.profession;
  return readProfessionSpecializationState<EngineerState>(state, expectedKind) || {};
}

/** Re-exports shared boon, health, and target-condition queries for Engineer modifier rules. */
export { activeBoonStacks, playerHealthFraction, targetConditionCount, targetHealthFraction };

/** Reports whether a timed field on the active Engineer specialization remains active. */
export function activeEngineerSpecializationState(
  context: Gw2ModifierContext,
  expectedKind: string,
  field: keyof EngineerState
): boolean {
  const state = engineerSpecializationState(context, expectedKind);
  return Number(state[field] || 0) > context.time;
}
