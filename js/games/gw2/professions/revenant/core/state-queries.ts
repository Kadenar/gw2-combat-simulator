import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { RevenantState } from '#gw2/professions/revenant/types.js';

/** Runtime and detached previews expose the same owned state without loading modifier execution. */
function revenantRuntimeState(context: Gw2ModifierContext): object | undefined {
  return context.runtime?.profession ?? context.state?.profession;
}

export function revenantRuntimeCoreState(context: Gw2ModifierContext): Partial<RevenantCoreState> {
  return readProfessionCoreState<RevenantCoreState>(revenantRuntimeState(context));
}

export function revenantRuntimeSpecializationState(
  context: Gw2ModifierContext,
  expectedKind: string
): Partial<RevenantState> {
  return readProfessionSpecializationState<RevenantState>(revenantRuntimeState(context), expectedKind) || {};
}
