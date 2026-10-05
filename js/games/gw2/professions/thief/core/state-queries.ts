import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';

import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';

/** Read live Core state without importing modifier assembly or active trait reactions. */
export function thiefRuntimeState(context: Gw2ModifierContext): Partial<ThiefCoreState> {
  return readProfessionCoreState<ThiefCoreState>(context.runtime?.profession);
}

// Return specialization state only when its runtime kind matches, preventing
// modifier rules from interpreting another Thief module's state shape.
export function thiefRuntimeSpecializationState<TState extends object = object>(
  context: Gw2ModifierContext,
  expectedKind: string
): Partial<TState> {
  return readProfessionSpecializationState<TState>(context.runtime?.profession, expectedKind) || {};
}
