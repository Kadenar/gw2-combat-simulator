import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { RevenantRuntimeState } from '#gw2/professions/revenant/types.js';

// Derive query results from the live union so new specializations cannot drift from their owned state types.
type SpecializationStateByKind = {
  [Specialization in RevenantRuntimeState['specialization'] as Specialization['kind']]: Specialization['state'];
};

/** Runtime and detached previews expose the same owned state without loading modifier execution. */
function revenantRuntimeState(context: Gw2ModifierContext): object | undefined {
  return context.runtime?.profession ?? context.state?.profession;
}

export function revenantRuntimeCoreState(context: Gw2ModifierContext): Partial<RevenantCoreState> {
  return readProfessionCoreState<RevenantCoreState>(revenantRuntimeState(context));
}

/** Expose only the requested specialization's fields; absent or inactive state remains an empty partial. */
export function revenantRuntimeSpecializationState<Kind extends keyof SpecializationStateByKind>(
  context: Gw2ModifierContext,
  expectedKind: Kind
): Partial<SpecializationStateByKind[Kind]> {
  return (
    readProfessionSpecializationState<SpecializationStateByKind[Kind]>(revenantRuntimeState(context), expectedKind) ||
    {}
  );
}
